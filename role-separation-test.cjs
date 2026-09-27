/**
 * Role-separation integration test.
 *
 * Drives the EXACT algorithm from src/components/AuthModal.jsx
 * (resolveAccountRole) together with the firestoreService role helpers against
 * the Firestore emulator, so client logic and security rules are verified
 * together. Identities are supplied with @firebase/rules-unit-testing, which
 * is the only way to get a token the Firestore emulator accepts.
 *
 * Run: npx firebase emulators:exec --only firestore "node role-separation-test.cjs"
 */
const { initializeTestEnvironment } = require('/Users/harshitjindal/job sphere/node_modules/@firebase/rules-unit-testing');
const {
  getDoc, setDoc, doc, collection, getDocs, query, where, limit, serverTimestamp
} = require('/Users/harshitjindal/job sphere/node_modules/firebase/firestore');
const fs = require('fs');

const PROJECT = 'job-sphere-d1f67';
const RULES = fs.readFileSync('/Users/harshitjindal/job sphere/firestore.rules', 'utf8');
const ROLE_LABEL = { user: 'a Job Seeker', company: 'a Company' };

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   -> ' + detail : ''}`);
};

let testEnv;
let RUN;

// An "identity" is what resolveAccountRole consumes: a uid, an email (as the
// rules would see it in request.auth.token.email) and a Firestore handle.
const ctxFor = (uid, email) => {
  const c = testEnv.authenticatedContext(uid, { email });
  return { uid, email, firestore: () => c.firestore() };
};
const rawCtxFor = (uid, email) => testEnv.authenticatedContext(uid, { email });

/** firebaseService.findAccountsByEmail - same body, identity injected. */
async function findAccountsByEmail(db, uid, email) {
  if (!email) return [];
  const target = String(email).trim().toLowerCase();
  const own = String(email).trim().toLowerCase();
  if (!own || target !== own) throw new Error('You can only look up accounts for your own email address.');
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(20)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'permission-denied') {
      console.error('Role check unavailable: deploy firestore.rules to enforce one email = one role.', error);
      return null;
    }
    throw error;
  }
}

/** firebaseService.findConflictingRole */
async function findConflictingRole(db, uid, email, desiredRole) {
  const accounts = await findAccountsByEmail(db, uid, email);
  if (accounts === null) return { verified: false, role: null };
  const conflict = accounts.find(a => a.uid !== uid && a.role && a.role !== desiredRole);
  return { verified: true, role: conflict?.role || null };
}

/** firebaseService.createAccountProfile */
async function createAccountProfile(db, uid, email, { role, name, photo }) {
  if (role !== 'company' && role !== 'user') throw new Error('Unknown account type.');
  const displayName = name || (email || 'User').split('@')[0];
  await setDoc(doc(db, 'users', uid), {
    uid, email, name: displayName,
    photo: photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`,
    role, createdAt: serverTimestamp()
  });
  return uid;
}

/** AuthModal.resolveAccountRole - verbatim logic */
async function resolveAccountRole(identity, expectedRole, profile) {
  if (!expectedRole) return { ok: true };
  const db = identity.firestore();

  try {
    const snap = await getDoc(doc(db, 'users', identity.uid));
    if (snap.exists()) {
      const existingRole = snap.data().role;
      if (existingRole && existingRole !== expectedRole) {
        return {
          ok: false, role: existingRole,
          message: `This account is registered as ${ROLE_LABEL[existingRole]}. Please sign in from the ${existingRole === 'company' ? 'Company' : 'Job Seeker'} page.`
        };
      }
      return { ok: true, role: existingRole || expectedRole };
    }
  } catch (err) {
    console.warn('Could not read the account role document:', err);
    return { ok: true, role: expectedRole };
  }

  const { verified, role: takenRole } = await findConflictingRole(db, identity.uid, identity.email, expectedRole);
  if (verified && takenRole) {
    return {
      ok: false, role: takenRole,
      message: `This email is already registered as ${ROLE_LABEL[takenRole]}. One email address can only have one account type - please sign in as ${ROLE_LABEL[takenRole]}.`
    };
  }

  try {
    await createAccountProfile(db, identity.uid, identity.email, { role: expectedRole, name: profile?.name, photo: profile?.photo });
    return { ok: true, role: expectedRole };
  } catch (err) {
    return { ok: false, role: expectedRole, error: err.message };
  }
}

const roleInDbAsOwner = async (uid, email) => {
  const snap = await getDoc(doc(rawCtxFor(uid, email).firestore(), 'users', uid));
  return snap.exists() ? snap.data().role : null;
};

(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: RULES } });
  RUN = Math.random().toString(36).slice(2, 7);
  const E = (s) => `${s}.${RUN}@example.com`;

  const seedDoc = async (uid, email, role) => {
    await testEnv.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'users', uid), { uid, email, role, name: uid });
    });
  };

  try {
    await testEnv.clearFirestore();
    console.log('\n============ ROLE SEPARATION SCENARIOS ============\n');

    // ---------------------------------------------------------------- 1
    console.log('1. First-time registration on each page must still work');
    const sEmail = E('seeker1');
    const s1 = await resolveAccountRole(ctxFor('uid_s1', sEmail), 'user', { name: 'Seeker One' });
    check(s1.ok && s1.role === 'user', 'brand new email registers as Job Seeker', s1.message || s1.role);
    const cEmail = E('comp1');
    const c1 = await resolveAccountRole(ctxFor('uid_c1', cEmail), 'company', { name: 'Company One' });
    check(c1.ok && c1.role === 'company', 'brand new email registers as Company', c1.message || c1.role);
    check((await roleInDbAsOwner('uid_s1', sEmail)) === 'user', 'users/{uid_s1}.role == user written to Firestore');
    check((await roleInDbAsOwner('uid_c1', cEmail)) === 'company', 'users/{uid_c1}.role == company written to Firestore');

    // ---------------------------------------------------------------- 2
    console.log('\n2. Existing account signs in on its own page (regression)');
    const s1again = await resolveAccountRole(ctxFor('uid_s1', sEmail), 'user');
    check(s1again.ok, 'seeker signing in on the Seeker page is allowed', s1again.message);
    const c1again = await resolveAccountRole(ctxFor('uid_c1', cEmail), 'company');
    check(c1again.ok, 'company signing in on the Company page is allowed', c1again.message);

    // ---------------------------------------------------------------- 3
    console.log('\n3. Existing account signs in on the WRONG page (must be rejected)');
    const sOnCompany = await resolveAccountRole(ctxFor('uid_s1', sEmail), 'company');
    check(!sOnCompany.ok && sOnCompany.role === 'user', 'seeker on Company page is rejected', sOnCompany.message);
    const cOnSeeker = await resolveAccountRole(ctxFor('uid_c1', cEmail), 'user');
    check(!cOnSeeker.ok && cOnSeeker.role === 'company', 'company on Seeker page is rejected', cOnSeeker.message);
    check((await roleInDbAsOwner('uid_s1', sEmail)) === 'user', 'rejected attempt did NOT change the stored role');

    // ---------------------------------------------------------------- 4
    console.log('\n4. THE BUG: a second account id for an email that is already registered');
    console.log('   (this is what Firebase Auth does for a Google identity whose email');
    console.log('    already has a password account - a brand new uid, same email)');
    // seeker's email now gets a second uid, which tries to register as Company
    const gSeeker = await resolveAccountRole(ctxFor('uid_s1_google', sEmail), 'company', { name: 'Seeker As Co' });
    check(!gSeeker.ok && gSeeker.role === 'user', 'seeker email CANNOT come in as Company', gSeeker.message);
    // company's email gets a second uid which tries to register as Job Seeker
    const gCompany = await resolveAccountRole(ctxFor('uid_c1_google', cEmail), 'user', { name: 'Co As Seeker' });
    check(!gCompany.ok && gCompany.role === 'company', 'company email CANNOT come in as Job Seeker', gCompany.message);
    // and the original accounts are untouched
    check((await roleInDbAsOwner('uid_s1', sEmail)) === 'user', 'original seeker account still role=user');
    check((await roleInDbAsOwner('uid_c1', cEmail)) === 'company', 'original company account still role=company');

    // ---------------------------------------------------------------- 5
    console.log('\n5. Same-role second account is not a conflict');
    const same1 = await resolveAccountRole(ctxFor('uid_s1_dup', sEmail), 'user', { name: 'Seeker Two' });
    check(same1.ok, 'a second Job Seeker account for the same email is allowed', same1.message);

    // ---------------------------------------------------------------- 6
    console.log('\n6. Legacy accounts that exist in Auth but have no users document');
    const legacyFree = E('legacy_free');
    const legacy = await resolveAccountRole(ctxFor('uid_legacy', legacyFree), 'company', { name: 'Legacy Co' });
    check(legacy.ok && legacy.role === 'company', 'roleless Auth account is provisioned with the page role', legacy.message);
    const legacyTaken = E('seeker1'); // same email as the seeker
    const legacyBlocked = await resolveAccountRole(ctxFor('uid_legacy2', legacyTaken), 'company');
    check(!legacyBlocked.ok && legacyBlocked.role === 'user', 'roleless Auth account for a taken email is rejected', legacyBlocked.message);

    // ---------------------------------------------------------------- 7
    console.log('\n7. Seeded legacy data with a pre-existing duplicate');
    await seedDoc('uid_dup_a', E('dup'), 'user');
    const dupB = await resolveAccountRole(ctxFor('uid_dup_b', E('dup')), 'company');
    check(!dupB.ok && dupB.role === 'user', 'pre-existing duplicate data is now rejected going forward', dupB.message);

    // ---------------------------------------------------------------- 8
    console.log('\n8. The guard cannot be turned into a directory of other users');
    let refused = false;
    try {
      await getDocs(query(collection(rawCtxFor('uid_s1', sEmail).firestore(), 'users'), where('email', '==', cEmail), limit(20)));
    } catch (e) { refused = e.code === 'permission-denied'; }
    check(refused, 'probing a FOREIGN email is refused by the rules');
    let refusedAnon = false;
    try {
      await getDocs(query(collection(testEnv.unauthenticatedContext().firestore(), 'users'), where('email', '==', sEmail), limit(20)));
    } catch (e) { refusedAnon = e.code === 'permission-denied'; }
    check(refusedAnon, 'unauthenticated probing is refused by the rules');

    console.log(`\n============ RESULT: ${pass} passed, ${fail} failed ============\n`);
  } finally {
    await testEnv.cleanup();
  }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
