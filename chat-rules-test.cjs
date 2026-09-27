/**
 * Firestore security rules tests for the JobSphere messaging system.
 *
 * Verifies that only the two participants of a conversation can see it, read its
 * messages and send into it, that the sender identity cannot be spoofed, and
 * that the queries the React app actually issues are permitted.
 *
 * Run: npm run test:chats
 */
const { initializeTestEnvironment, assertFails, assertSucceeds } =
  require('/Users/harshitjindal/job sphere/node_modules/@firebase/rules-unit-testing');
const {
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit
} = require('/Users/harshitjindal/job sphere/node_modules/firebase/firestore');
const fs = require('fs');

const PROJECT = 'job-sphere-d1f67';
const RULES = fs.readFileSync('/Users/harshitjindal/job sphere/firestore.rules', 'utf8');

const SEEKER = 'uid_seeker';
const COMPANY = 'uid_company';
const OUTSIDER = 'uid_outsider';

const E_SEEKER = 'seeker@example.com';
const E_COMPANY = 'company@example.com';

const CHAT = 'dm_aaa_bbb';

let pass = 0, fail = 0;
async function check(label, fn, want) {
  let got;
  try { await fn(); got = 'ALLOWED'; } catch (e) { got = e.code === 'permission-denied' ? 'DENIED' : `ERR:${e.code || e.message}`; }
  const good = got === want;
  good ? pass++ : fail++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${label.padEnd(66)} -> ${got}${good ? '' : `   (expected ${want})`}`);
}

// For assertions that inspect the result instead of just allow/deny.
// `accept` is a string or a list of acceptable outcomes.
async function checkValue(label, fn, accept = 'PASS') {
  let got;
  try { got = await fn(); } catch (e) { got = `ERR:${e.code || e.message}`; }
  const okList = Array.isArray(accept) ? accept : [accept];
  const good = okList.includes(got);
  good ? pass++ : fail++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${label.padEnd(66)} -> ${got}${good ? '' : `   (expected one of ${okList.join(' | ')})`}`);
}

(async () => {
  const testEnv = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: RULES } });
  const S = testEnv.authenticatedContext(SEEKER, { email: E_SEEKER }).firestore();
  const C = testEnv.authenticatedContext(COMPANY, { email: E_COMPANY }).firestore();
  const O = testEnv.authenticatedContext(OUTSIDER, { email: 'outsider@example.com' }).firestore();
  const A = testEnv.unauthenticatedContext().firestore();

  const chatDoc = (db, id = CHAT) => doc(db, 'chats', id);
  const messages = (db, id = CHAT) => collection(db, 'chats', id, 'messages');
  const msg = { text: 'hi', senderUid: SEEKER, senderName: 'Seeker', sentAt: new Date() };

  try {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'chats', CHAT), {
        participants: [SEEKER, COMPANY],
        participantNames: { [SEEKER]: 'Seeker', [COMPANY]: 'Company' },
        participantPhotos: { [SEEKER]: '', [COMPANY]: '' },
        lastMessage: 'hi',
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await setDoc(doc(db, 'chats', CHAT, 'messages', 'm1'), msg);
    });

    console.log('\n############ CHAT RULES ############\n');

    console.log('A. Reading a conversation');
    await check('participant (seeker) can read the chat document', () => getDoc(chatDoc(S)), 'ALLOWED');
    await check('participant (company) can read the chat document', () => getDoc(chatDoc(C)), 'ALLOWED');
    await check('NON-participant cannot read the chat document', () => getDoc(chatDoc(O)), 'DENIED');
    await check('unauthenticated cannot read the chat document', () => getDoc(chatDoc(A)), 'DENIED');
    await check('NO broad read of the whole chats collection', () => getDocs(collection(S, 'chats')), 'DENIED');
    await check('cannot list every chat by a field other than my uid', () =>
      getDocs(query(collection(S, 'chats'), where('lastMessage', '==', 'hi'), limit(5))), 'DENIED');

    // This is what makes "find or create a conversation" possible at all: a get
    // on a chat that does not exist yet must return "not found" rather than
    // permission-denied, otherwise a client can never check before creating.
    await checkValue('get on a NOT-YET-EXISTING chat returns not-found (needed to create)', async () => {
      const snap = await getDoc(chatDoc(S, 'dm_does_not_exist'));
      return snap.exists() ? 'LEAK: document exists' : 'PASS';
    });
    await checkValue('that not-found get also reveals nothing to an outsider', async () => {
      const snap = await getDoc(chatDoc(O, 'dm_does_not_exist'));
      return snap.exists() ? 'LEAK: outsider can see the doc' : 'PASS';
    });
    await checkValue('a get on a chat the caller is NOT in still exposes nothing', async () => {
      try {
        const snap = await getDoc(chatDoc(O, CHAT));
        return snap.exists() ? 'LEAK: outsider read the chat' : 'PASS_NO_DATA';
      } catch (e) {
        return e.code === 'permission-denied' ? 'PASS_DENIED' : 'UNEXPECTED_' + e.code;
      }
    }, ['PASS_DENIED', 'PASS_NO_DATA']);

    console.log('\nB. The chat-list query the app actually uses');
    await check('seeker: participants array-contains + orderBy lastMessageAt', () =>
      getDocs(query(collection(S, 'chats'), where('participants', 'array-contains', SEEKER), orderBy('lastMessageAt', 'desc'), limit(50))), 'ALLOWED');
    await check('company: same query for its own uid', () =>
      getDocs(query(collection(C, 'chats'), where('participants', 'array-contains', COMPANY), orderBy('lastMessageAt', 'desc'), limit(50))), 'ALLOWED');
    await checkValue('the query returns ONLY that user\'s conversation', async () => {
      const snap = await getDocs(query(collection(S, 'chats'), where('participants', 'array-contains', SEEKER), limit(50)));
      if (snap.size !== 1) return `expected 1 chat, got ${snap.size}`;
      if (snap.docs[0].id !== CHAT) return `wrong chat: ${snap.docs[0].id}`;
      return 'PASS';
    });
    await check('cannot run the chat list for ANOTHER user\'s uid', () =>
      getDocs(query(collection(S, 'chats'), where('participants', 'array-contains', COMPANY), limit(50))), 'DENIED');
    await check('unauthenticated cannot list any chat', () =>
      getDocs(query(collection(A, 'chats'), where('participants', 'array-contains', SEEKER), limit(50))), 'DENIED');

    console.log('\nC. Reading messages');
    await check('participant can read the message list', () => getDocs(messages(S)), 'ALLOWED');
    await check('the messages query the app uses (orderBy sentAt asc)', () =>
      getDocs(query(messages(S), orderBy('sentAt', 'asc'))), 'ALLOWED');
    await check('other participant can read the message list', () => getDocs(messages(C)), 'ALLOWED');
    await check('NON-participant cannot read the message list', () => getDocs(messages(O)), 'DENIED');
    await check('unauthenticated cannot read the message list', () => getDocs(messages(A)), 'DENIED');
    await check('a participant cannot read messages of a chat they are not in', () =>
      getDocs(messages(S, 'dm_zzz')), 'DENIED');
    await check('a participant cannot read a single message of another chat', () =>
      getDoc(doc(S, 'chats', 'dm_zzz', 'messages', 'm1')), 'DENIED');

    console.log('\nD. Sending a message');
    await check('participant can send a message as themselves', () =>
      setDoc(doc(S, 'chats', CHAT, 'messages', 'new1'), { ...msg }), 'ALLOWED');
    await check('other participant can send a message as themselves', () =>
      setDoc(doc(C, 'chats', CHAT, 'messages', 'new2'), { ...msg, senderUid: COMPANY, senderName: 'Company' }), 'ALLOWED');
    await check('NON-participant cannot send a message', () =>
      setDoc(doc(O, 'chats', CHAT, 'messages', 'bad1'), { ...msg, senderUid: OUTSIDER }), 'DENIED');
    await check('unauthenticated cannot send a message', () =>
      setDoc(doc(A, 'chats', CHAT, 'messages', 'bad2'), { ...msg }), 'DENIED');
    await check('SENDER SPOOFING blocked: cannot send as somebody else', () =>
      setDoc(doc(S, 'chats', CHAT, 'messages', 'bad3'), { ...msg, senderUid: COMPANY, senderName: 'Company' }), 'DENIED');
    await check('cannot send into a chat you are not part of', () =>
      setDoc(doc(O, 'chats', 'dm_zzz', 'messages', 'bad4'), { ...msg, senderUid: OUTSIDER }), 'DENIED');

    console.log('\nE. Editing / deleting messages');
    await check('sender can edit their own message', () =>
      updateDoc(doc(S, 'chats', CHAT, 'messages', 'm1'), { text: 'edited' }), 'ALLOWED');
    await check('a participant who is NOT the sender cannot edit a message', () =>
      updateDoc(doc(C, 'chats', CHAT, 'messages', 'm1'), { text: 'hijacked' }), 'DENIED');
    await check('NON-participant cannot edit a message', () =>
      updateDoc(doc(O, 'chats', CHAT, 'messages', 'm1'), { text: 'hijacked' }), 'DENIED');
    await check('messages cannot be deleted by anyone', () =>
      deleteDoc(doc(S, 'chats', CHAT, 'messages', 'm1')), 'DENIED');

    console.log('\nF. Creating a conversation');
    await check('can create a chat that includes yourself', () =>
      setDoc(doc(S, 'chats', 'dm_new_1'), {
        participants: [SEEKER, 'uid_someone'],
        participantNames: {}, participantPhotos: {},
        lastMessage: '', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date()
      }), 'ALLOWED');
    await check('cannot create a chat that EXCLUDES yourself', () =>
      setDoc(doc(S, 'chats', 'dm_new_2'), {
        participants: ['uid_a', 'uid_b'],
        participantNames: {}, participantPhotos: {},
        lastMessage: '', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date()
      }), 'DENIED');
    await check('cannot create a group chat with 3 participants', () =>
      setDoc(doc(S, 'chats', 'dm_new_3'), {
        participants: [SEEKER, 'uid_a', 'uid_b'],
        participantNames: {}, participantPhotos: {},
        lastMessage: '', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date()
      }), 'DENIED');
    await check('unauthenticated cannot create a chat', () =>
      setDoc(doc(A, 'chats', 'dm_new_4'), {
        participants: [SEEKER, 'uid_a'],
        participantNames: {}, participantPhotos: {},
        lastMessage: '', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date()
      }), 'DENIED');

    console.log('\nG. Conversation list metadata (what sendMessage updates)');
    await check('participant can update lastMessage / lastMessageAt / updatedAt', () =>
      updateDoc(chatDoc(S), { lastMessage: 'hey', lastMessageAt: new Date(), updatedAt: new Date() }), 'ALLOWED');
    await check('participant can refresh participantNames / participantPhotos', () =>
      updateDoc(chatDoc(S), { participantNames: { [SEEKER]: 'New Name' } }), 'ALLOWED');
    await check('participant CANNOT change the participant list', () =>
      updateDoc(chatDoc(S), { participants: [SEEKER, OUTSIDER] }), 'DENIED');
    await check('participant CANNOT add arbitrary fields', () =>
      updateDoc(chatDoc(S), { hacked: true }), 'DENIED');
    await check('NON-participant cannot update the conversation', () =>
      updateDoc(chatDoc(O), { lastMessage: 'x' }), 'DENIED');
    await check('chats cannot be deleted', () => deleteDoc(chatDoc(S)), 'DENIED');

    console.log(`\n############ RESULT: ${pass} passed, ${fail} failed ############\n`);
  } finally {
    await testEnv.cleanup();
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
