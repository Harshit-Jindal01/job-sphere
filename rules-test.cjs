/**
 * Firestore security rules test for JobSphere role separation.
 * Uses @firebase/rules-unit-testing against the local Firestore emulator,
 * so the rules engine is exercised exactly as deployed.
 *
 * Run:  npx firebase emulators:exec --only firestore "node rules-test.cjs"
 */
const {
  initializeTestEnvironment, assertFails, assertSucceeds
} = require('/Users/harshitjindal/job sphere/node_modules/@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT = 'job-sphere-d1f67';
const RULES = fs.readFileSync('/Users/harshitjindal/job sphere/firestore.rules', 'utf8');

const UID_SEEKER = 'uid_seeker';
const UID_COMPANY = 'uid_company';
const UID_STRANGER = 'uid_stranger';
const E_SEEKER = 'seeker@example.com';
const E_COMPANY = 'company@example.com';
const E_STRANGER = 'stranger@example.com';

const seeded = {
  users: {
    [UID_SEEKER]: { uid: UID_SEEKER, email: E_SEEKER, role: 'user', name: 'Seeker One' },
    [UID_COMPANY]: { uid: UID_COMPANY, email: E_COMPANY, role: 'company', name: 'Company One' },
    [UID_STRANGER]: { uid: UID_STRANGER, email: E_STRANGER, role: 'company', name: 'Stranger Co' },
    uid_nodoc: { uid: 'uid_nodoc', email: 'nodoc@example.com', role: 'company', name: 'Another Company' }
  }
};

let pass = 0, fail = 0;
const results = [];
function record(ok, label, detail = '') {
  ok ? pass++ : fail++;
  results.push({ ok, label, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
}

async function test(label, fn) {
  try {
    await fn();
    record(true, label);
  } catch (e) {
    record(false, label, e.message?.split('\n')[0]);
  }
}

(async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: RULES }
  });

  try {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const [id, data] of Object.entries(seeded.users)) {
        const { setDoc, doc } = require('/Users/harshitjindal/job sphere/node_modules/firebase/firestore');
        await setDoc(doc(db, 'users', id), data);
      }
    });

    const seekerCtx = testEnv.authenticatedContext(UID_SEEKER, { email: E_SEEKER });
    const companyCtx = testEnv.authenticatedContext(UID_COMPANY, { email: E_COMPANY });
    const anonCtx = testEnv.unauthenticatedContext();

    const S = seekerCtx.firestore();
    const C = companyCtx.firestore();
    const A = anonCtx.firestore();

    const { doc, collection, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, limit } =
      require('/Users/harshitjindal/job sphere/node_modules/firebase/firestore');

    const emailLookup = (db, email) =>
      getDocs(query(collection(db, 'users'), where('email', '==', email), limit(5)));

    console.log(`\n############ RULES UNDER TEST ############\n`);

    // ---------------------------------------------------------------- A
    console.log('A. EXISTING BEHAVIOUR MUST NOT REGRESS');
    await test('owner can read own users doc', () => assertSucceeds(getDoc(doc(S, 'users', UID_SEEKER))));
    await test('owner can update own users doc (name only)', () =>
      assertSucceeds(updateDoc(doc(S, 'users', UID_SEEKER), { name: 'Renamed' })));
    await test('non-owner CANNOT read another users doc', () => assertFails(getDoc(doc(S, 'users', UID_COMPANY))));
    await test('unauthenticated CANNOT read a users doc', () => assertFails(getDoc(doc(A, 'users', UID_SEEKER))));
    await test('user directory search stays denied', () =>
      assertFails(getDocs(query(collection(S, 'users'), where('name', '>=', 'A'), limit(5)))));
    await test('non-owner CANNOT update another users doc', () =>
      assertFails(updateDoc(doc(S, 'users', UID_COMPANY), { name: 'hacked' })));
    await test('non-owner CANNOT delete another users doc', () =>
      assertFails(deleteDoc(doc(S, 'users', UID_COMPANY))));
    await test('user CANNOT create a users doc for another uid', () =>
      assertFails(setDoc(doc(S, 'users', 'somebody_elses_uid'), { uid: 'somebody_elses_uid', email: E_SEEKER, role: 'company' })));
    await test('user CANNOT create a users doc with someone elses email', () =>
      assertFails(setDoc(doc(S, 'users', UID_SEEKER), { uid: UID_SEEKER, email: 'other@x.com', role: 'user' })));
    await test('user CANNOT change their own role user -> company', () =>
      assertFails(updateDoc(doc(S, 'users', UID_SEEKER), { role: 'company' })));
    await test('user CANNOT change their own email', () =>
      assertFails(updateDoc(doc(S, 'users', UID_SEEKER), { email: 'new@x.com' })));

    // ---------------------------------------------------------------- B
    console.log('\nB. EMAIL -> ROLE LOOKUP (how the app enforces one email = one role)');
    // The client can only ever query its OWN email (the rules refuse anything
    // else), and that query returns EVERY account sharing that email - which is
    // precisely the information the duplicate-role guard needs.
    await test('seeker can look up their OWN email', () => assertSucceeds(emailLookup(S, E_SEEKER)));
    await test('own-email lookup returns the account and its role', async () => {
      const snap = await emailLookup(S, E_SEEKER);
      if (snap.size !== 1) throw new Error(`expected 1 doc, got ${snap.size}`);
      if (snap.docs[0].data().role !== 'user') throw new Error('role not readable');
    });
    await test('a second account sees the pre-existing role for the same email', async () => {
      // simulates the bug state: a new uid arrives with an email that already
      // has an account under a different role
      const dup = testEnv.authenticatedContext('uid_dup_new', { email: E_SEEKER });
      const snap = await emailLookup(dup.firestore(), E_SEEKER);
      if (snap.size < 1) throw new Error('pre-existing account not visible');
      const foreign = snap.docs.filter((d) => d.id !== 'uid_dup_new');
      if (foreign.length !== 1) throw new Error(`expected 1 foreign account, got ${foreign.length}`);
      if (foreign[0].data().role !== 'user') throw new Error('foreign role not readable');
    });
    await test('unauthenticated CANNOT look up any email', () => assertFails(emailLookup(A, E_SEEKER)));
    await test('CANNOT look up a FOREIGN email (no cross-account probing)', () =>
      assertFails(emailLookup(S, E_COMPANY)));
    await test('CANNOT look up a made-up email', () => assertFails(emailLookup(S, 'nobody@example.com')));

    // ---------------------------------------------------------------- C
    console.log('\nC. THE LOOKUP MUST NOT BECOME A DATA LEAK');
    await test('seeker CANNOT list all users', () => assertFails(getDocs(collection(S, 'users'))));
    await test('seeker CANNOT list users by role', () =>
      assertFails(getDocs(query(collection(S, 'users'), where('role', '==', 'company'), limit(5)))));
    await test('seeker CANNOT list users by uid', () =>
      assertFails(getDocs(query(collection(S, 'users'), where('uid', '==', UID_COMPANY), limit(5)))));
    await test('seeker CANNOT list users by name range', () =>
      assertFails(getDocs(query(collection(S, 'users'), where('name', '>=', 'A'), limit(5)))));
    await test('email lookup for a foreign email is REFUSED, not filtered', () =>
      assertFails(emailLookup(S, 'victim@somewhere-else.com')));
    await test('own-email lookup returns ONLY same-email docs', async () => {
      const snap = await emailLookup(S, E_SEEKER);
      for (const d of snap.docs) {
        if (d.data().email !== E_SEEKER) throw new Error(`leaked doc with email ${d.data().email}`);
      }
    });

    // ---------------------------------------------------------------- D
    console.log('\nD. OTHER COLLECTIONS UNAFFECTED');
    await test('seeker can create a post with own authorId', () =>
      assertSucceeds(setDoc(doc(S, 'posts', 'p1'), {
        authorId: UID_SEEKER, content: 'hi', imageUrl: null, likes: [], commentCount: 0
      })));
    await test('seeker CANNOT create a post with someone elses authorId', () =>
      assertFails(setDoc(doc(S, 'posts', 'p2'), {
        authorId: 'someone_else', content: 'hi', likes: [], commentCount: 0
      })));
    await test('seeker can read the posts feed', () => assertSucceeds(getDocs(collection(S, 'posts'))));
    await test('seeker can create a connection request', () =>
      assertSucceeds(setDoc(doc(S, 'connections', 'c1'), { from: UID_SEEKER, to: UID_COMPANY, status: 'pending' })));

    console.log(`\n############ RESULT: ${pass} passed, ${fail} failed ############\n`);
  } finally {
    await testEnv.cleanup();
  }

  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
