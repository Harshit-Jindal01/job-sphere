/**
 * Security-rules tests for the JobSphere job system, connections and the new
 * member directory.
 *
 * Run: npm run test:jobs
 */
const { initializeTestEnvironment, assertFails, assertSucceeds } =
  require('/Users/harshitjindal/job sphere/node_modules/@firebase/rules-unit-testing');
const {
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit
} = require('/Users/harshitjindal/job sphere/node_modules/firebase/firestore');
const fs = require('fs');

const PROJECT = 'job-sphere-d1f67';
const RULES = fs.readFileSync('/Users/harshitjindal/job sphere/firestore.rules', 'utf8');

const COMPANY = 'uid_company';
const OTHER_CO = 'uid_other_company';
const SEEKER = 'uid_seeker';
const OUTSIDER = 'uid_outsider';

let pass = 0, fail = 0;
async function check(label, fn, want) {
  let got;
  try { await fn(); got = 'ALLOWED'; } catch (e) { got = e.code === 'permission-denied' ? 'DENIED' : `ERR:${e.code || e.message}`; }
  const good = got === want;
  good ? pass++ : fail++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${label.padEnd(64)} -> ${got}${good ? '' : `   (expected ${want})`}`);
}

// The structured job payload the posting form now stores.
const newJob = (over = {}) => ({
  title: 'Senior Frontend Developer',
  company: 'Acme Labs',
  location: 'New York, USA',
  workType: 'Full-time',
  type: 'Full-time',
  remote: false,
  salary: '$100k - $130k',
  salaryMin: 100000,
  salaryMax: 130000,
  experienceLevel: 'Senior level',
  skills: ['React', 'TypeScript'],
  description: 'Build things.',
  requirements: '5+ years',
  postedBy: COMPANY,
  postedAt: new Date(),
  updatedAt: new Date(),
  ...over
});

// The current structured shape, including the predefined category / work mode.
const newJobV2 = (over = {}) => newJob({
  workType: 'Full-time',
  type: 'Full-time',
  workMode: 'Remote',
  remote: true,
  category: 'Software Development',
  experienceLevel: '5-8 years',
  ...over
});

(async () => {
  const testEnv = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: RULES } });
  const CO = testEnv.authenticatedContext(COMPANY, { email: 'co@e.com' }).firestore();
  const CO2 = testEnv.authenticatedContext(OTHER_CO, { email: 'co2@e.com' }).firestore();
  const COMPANY_UID = 'uid_company'; // the literal uid string, for seeded docs
  const SE = testEnv.authenticatedContext(SEEKER, { email: 'se@e.com' }).firestore();
  const OUT = testEnv.authenticatedContext(OUTSIDER, { email: 'out@e.com' }).firestore();
  const ANON = testEnv.unauthenticatedContext().firestore();

  // Seed helper: writes a connection with rules off, so each negative case
  // starts from a known state.
  // Returns true when the row is readable back, so a caller can be sure the
  // assertion it is about to make is not a no-op against a missing document.
  const seedConnection = async (id, from, to, status = 'pending') => {
    let exists = false;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'connections', id), {
        from, fromName: 'F', fromPhoto: '', to, toName: 'T', toPhoto: '',
        status, createdAt: new Date(), updatedAt: new Date()
      });
      exists = (await getDoc(doc(db, 'connections', id))).exists();
    });
    if (!exists) throw new Error(`seed ${id} was not written`);
    return true;
  };

  // Literal uid strings for seeded documents (the Firestore handle `CO` above
  // is an object, not a string, so it cannot be embedded in a document).
  const SE_UID = SEEKER;
  const CO_UID = COMPANY;
  const OUT_UID = OUTSIDER;

  try {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'jobs', 'j1'), newJob());
      await setDoc(doc(db, 'jobs', 'j_old'), {
        title: 'ai developer', company: 'Old Co', location: 'Remote',
        salary: '$80k - $95k', description: 'ai work', postedBy: OTHER_CO, postedAt: new Date()
      });
    });

    console.log('\n############ JOB / NETWORK / DIRECTORY RULES ############\n');

    console.log('A. Company creates a job with the structured schema');
    await check('company can create a fully structured job', () =>
      setDoc(doc(CO, 'jobs', 'new1'), newJob({ postedBy: COMPANY })), 'ALLOWED');
    await check('company can create a job with category + work mode', () =>
      setDoc(doc(CO, 'jobs', 'new1b'), newJobV2({ postedBy: COMPANY })), 'ALLOWED');
    await check('a job with only the legacy fields still reads back fine', () =>
      getDoc(doc(SE, 'jobs', 'j_old')), 'ALLOWED');
    await check('company CANNOT create a job owned by someone else', () =>
      setDoc(doc(CO, 'jobs', 'new2'), newJob({ postedBy: OTHER_CO })), 'DENIED');
    // The jobs rule only asserts ownership (postedBy == caller), so ANY signed
    // -in account can create a job owned by itself. The service layer and the
    // UI are what restrict posting to companies; the rule deliberately does not
    // read the users collection (that would cost a read per write). This test
    // documents that boundary explicitly.
    await check('a seeker account CAN create a job owned by itself (rule is ownership-based)', () =>
      setDoc(doc(SE, 'jobs', 'new3'), newJob({ postedBy: SEEKER, company: 'Acme' })), 'ALLOWED');
    await check('unauthenticated CANNOT create a job', () =>
      setDoc(doc(ANON, 'jobs', 'new4'), newJob({ postedBy: 'anon' })), 'DENIED');

    console.log('\nB. Company edits and deletes only its own job');
    await check('owning company can edit its job (structured fields)', () =>
      updateDoc(doc(CO, 'jobs', 'j1'), { salaryMin: 150000, experienceLevel: '8+ years', category: 'Data Science', workMode: 'Hybrid', skills: ['Go'], updatedAt: new Date() }), 'ALLOWED');
    await check('a different company CANNOT edit that job', () =>
      updateDoc(doc(CO2, 'jobs', 'j1'), { salaryMin: 1, updatedAt: new Date() }), 'DENIED');
    await check('a seeker CANNOT edit a job', () =>
      updateDoc(doc(SE, 'jobs', 'j1'), { salaryMin: 1, updatedAt: new Date() }), 'DENIED');
    await check('owning company can delete its own job', () => deleteDoc(doc(CO, 'jobs', 'j1')), 'ALLOWED');
    // j_old is owned by OTHER_CO; CO (and CO3) are genuinely different companies.
    await check('a different company CANNOT delete a job it does not own', () => deleteDoc(doc(CO, 'jobs', 'j_old')), 'DENIED');
    await check('a seeker CANNOT delete a job', () => deleteDoc(doc(SE, 'jobs', 'j_old')), 'DENIED');

    console.log('\nC. Seeker reads the job feed (search + filters are client-side)');
    await check('seeker can list all jobs (orderBy postedAt)', () =>
      getDocs(query(collection(SE, 'jobs'), orderBy('postedAt', 'desc'), limit(50))), 'ALLOWED');
    await check('company can list all jobs too', () =>
      getDocs(query(collection(CO, 'jobs'), orderBy('postedAt', 'desc'), limit(50))), 'ALLOWED');
    await check('outsider signed-in user can read the public job feed', () =>
      getDocs(query(collection(OUT, 'jobs'), orderBy('postedAt', 'desc'), limit(50))), 'ALLOWED');
    await check('unauthenticated CANNOT read jobs', () => getDocs(collection(ANON, 'jobs')), 'DENIED');

    console.log('\nD. Applications (duplicate prevention + status updates)');
    await check('seeker can apply with their own applicantUid', () =>
      setDoc(doc(SE, 'applications', 'a1'), {
        jobId: 'j_old', jobTitle: 'ai developer', companyName: 'Old Co', companyUid: OTHER_CO,
        applicantUid: SEEKER, applicantName: 'Seeker', applicantEmail: 'se@e.com', applicantPhoto: '',
        coverLetter: 'hi', resumeUrl: 'u', resumeFileName: 'r.pdf', status: 'pending', appliedAt: new Date()
      }), 'ALLOWED');
    await check('seeker CANNOT apply claiming someone else as applicant', () =>
      setDoc(doc(SE, 'applications', 'a2'), {
        jobId: 'j_old', companyUid: OTHER_CO, applicantUid: OUTSIDER, status: 'pending', appliedAt: new Date()
      }), 'DENIED');
    await check('the receiving company can accept (pending -> accepted)', () =>
      updateDoc(doc(CO2, 'applications', 'a1'), { status: 'accepted', updatedAt: new Date() }), 'ALLOWED');
    await check('the receiving company can reject (accepted -> rejected)', () =>
      updateDoc(doc(CO2, 'applications', 'a1'), { status: 'rejected', updatedAt: new Date() }), 'ALLOWED');
    await check('the applicant CANNOT change their own application status', () =>
      updateDoc(doc(SE, 'applications', 'a1'), { status: 'accepted', updatedAt: new Date() }), 'DENIED');
    await check('an unrelated company CANNOT change the status', () =>
      updateDoc(doc(CO, 'applications', 'a1'), { status: 'accepted', updatedAt: new Date() }), 'DENIED');
    await check('the applicant can read their own applications (applicantUid + orderBy)', () =>
      getDocs(query(collection(SE, 'applications'), where('applicantUid', '==', SEEKER), orderBy('appliedAt', 'desc'))), 'ALLOWED');
    await check('a company CANNOT read somebody elses applicant list', () =>
      getDocs(query(collection(CO, 'applications'), where('applicantUid', '==', OUTSIDER), orderBy('appliedAt', 'desc'))), 'DENIED');
    await check('an unrelated signed-in user CANNOT read a single application', () =>
      getDoc(doc(OUT, 'applications', 'a1')), 'DENIED');

    console.log('\nE. Connections: the Connect flow end to end');
    await check('A can send a request to B (from = A)', () =>
      setDoc(doc(SE, 'connections', 'c1'), {
        from: SEEKER, fromName: 'Seeker', fromPhoto: '', to: OTHER_CO, toName: 'Co', toPhoto: '',
        status: 'pending', createdAt: new Date()
      }), 'ALLOWED');
    await check('A CANNOT send a request claiming to be from B', () =>
      setDoc(doc(SE, 'connections', 'c2'), {
        from: OTHER_CO, to: OUTSIDER, status: 'pending', createdAt: new Date()
      }), 'DENIED');
    await check('A CANNOT send a request to himself', () =>
      setDoc(doc(SE, 'connections', 'c3'), { from: SEEKER, to: SEEKER, status: 'pending', createdAt: new Date() }), 'DENIED');
    await check('A CANNOT create a request that is already accepted', () =>
      setDoc(doc(SE, 'connections', 'c4'), { from: SEEKER, to: OUTSIDER, status: 'accepted', createdAt: new Date() }), 'DENIED');
    await check('A can send a request to a company', () =>
      setDoc(doc(SE, 'connections', 'c1b'), {
        from: SEEKER, fromName: 'Seeker', fromPhoto: '', to: OTHER_CO, toName: 'Co', toPhoto: '',
        status: 'pending', createdAt: new Date()
      }), 'ALLOWED');
    await check('the RECIPIENT can accept the request', () =>
      updateDoc(doc(CO2, 'connections', 'c1'), { status: 'accepted', updatedAt: new Date() }), 'ALLOWED');
    await seedConnection('c5', SE_UID, OUT_UID);
    await check('the SENDER CANNOT accept their own request', () =>
      updateDoc(doc(SE, 'connections', 'c5'), { status: 'accepted', updatedAt: new Date() }), 'DENIED');
    await seedConnection('c6', SE_UID, CO_UID);
    await check('an unrelated user CANNOT accept a request', () =>
      updateDoc(doc(OUT, 'connections', 'c6'), { status: 'accepted', updatedAt: new Date() }), 'DENIED');
    await seedConnection('c7', SE_UID, CO_UID);
    await check('the SENDER can decline their own sent request (delete)', () =>
      deleteDoc(doc(SE, 'connections', 'c7')), 'ALLOWED');
    await seedConnection('c8', SE_UID, CO_UID);
    await check('the RECIPIENT can decline (delete) a received request', () =>
      deleteDoc(doc(CO, 'connections', 'c8')), 'ALLOWED');
    await seedConnection('c9', SE_UID, OUT_UID);
    await check('an unrelated user CANNOT delete someone elses request', () =>
      deleteDoc(doc(CO, 'connections', 'c9')), 'DENIED');
    await check('sender sees their sent requests (from + status)', () =>
      getDocs(query(collection(SE, 'connections'), where('from', '==', SEEKER), where('status', '==', 'pending'))), 'ALLOWED');
    await check('recipient sees received requests (to + status)', () =>
      getDocs(query(collection(CO2, 'connections'), where('to', '==', OTHER_CO), where('status', '==', 'pending'))), 'ALLOWED');
    await check('nobody can list ALL connections', () => getDocs(collection(SE, 'connections')), 'DENIED');
    await check('an unrelated user CANNOT read a specific connection', () => getDoc(doc(OUT, 'connections', 'c1')), 'DENIED');

    console.log('\nF. Member directory (the public projection behind Find People)');
    const dirEntry = (uid) => ({
      uid, name: 'Person ' + uid, photo: '', role: 'user', jobTitle: 'Engineer',
      company: '', headline: 'Builds things', bio: 'Long bio', skills: ['React'],
      skillsText: 'React', location: 'Bengaluru', experience: '5 years',
      degree: 'BSc', institution: 'Some Uni', linkedin: '', github: '', portfolio: '',
      updatedAt: new Date()
    });
    await check('a member can publish their OWN directory entry', () =>
      setDoc(doc(SE, 'userDirectory', SEEKER), dirEntry(SEEKER)), 'ALLOWED');
    await check('a member CANNOT publish an entry for someone else', () =>
      setDoc(doc(SE, 'userDirectory', OUTSIDER), dirEntry(OUTSIDER)), 'DENIED');
    await check('a member CANNOT publish an entry that does not match their uid', () =>
      setDoc(doc(SE, 'userDirectory', 'x1'), { ...dirEntry(SEEKER), uid: 'x1' }), 'DENIED');
    await check('a member CANNOT put an email address in the directory', () =>
      setDoc(doc(SE, 'userDirectory', 'x2'), { ...dirEntry(SEEKER), uid: 'x2', email: 'leak@e.com' }), 'DENIED');
    await check('a member CANNOT put a resume/phone in the directory', () =>
      setDoc(doc(SE, 'userDirectory', 'x3'), { ...dirEntry(SEEKER), uid: 'x3', resumeUrl: 'secret' }), 'DENIED');
    await check('a member CANNOT publish a private date of birth', () =>
      setDoc(doc(SE, 'userDirectory', 'x4'), { ...dirEntry(SEEKER), uid: 'x4', dob: '1990-01-01' }), 'DENIED');
    await check('a member CANNOT publish a phone number', () =>
      setDoc(doc(SE, 'userDirectory', 'x5'), { ...dirEntry(SEEKER), uid: 'x5', phone: '+1' }), 'DENIED');
    await check('a member can maintain their own entry', () =>
      updateDoc(doc(SE, 'userDirectory', SEEKER), { jobTitle: 'Senior Engineer', updatedAt: new Date() }), 'ALLOWED');
    await check('a member CANNOT smuggle an email in via update', () =>
      updateDoc(doc(SE, 'userDirectory', SEEKER), { email: 'leak@e.com' }), 'DENIED');
    await check('a member CANNOT edit another members entry', () =>
      updateDoc(doc(CO, 'userDirectory', SEEKER), { name: 'Hacked', updatedAt: new Date() }), 'DENIED');
    await check('any signed-in member can BROWSE the directory', () => getDocs(collection(CO, 'userDirectory')), 'ALLOWED');
    await check('browseDirectory: orderBy updatedAt desc', () =>
      getDocs(query(collection(CO, 'userDirectory'), orderBy('updatedAt', 'desc'), limit(48))), 'ALLOWED');
    await check('searchUsers: name prefix range', () =>
      getDocs(query(collection(CO, 'userDirectory'), where('name', '>=', 'Per'), where('name', '<=', 'Per\uf8ff'), limit(20))), 'ALLOWED');
    for (const field of ['jobTitle', 'company', 'headline', 'skillsText']) {
      await check(`searchUsers: ${field} prefix range`, () =>
        getDocs(query(collection(CO, 'userDirectory'), where(field, '>=', 'A'), where(field, '<=', 'A\uf8ff'), limit(20))), 'ALLOWED');
    }
    await check('unauthenticated CANNOT browse the directory', () => getDocs(collection(ANON, 'userDirectory')), 'DENIED');
    await check('a member CAN read a single public directory entry (View Profile)', () =>
      getDoc(doc(CO, 'userDirectory', SEEKER)), 'ALLOWED');
    await check('the private `users` collection is STILL not listable', () => getDocs(collection(SE, 'users')), 'DENIED');
    await check('the private `userProfiles` collection is STILL not listable', () => getDocs(collection(SE, 'userProfiles')), 'DENIED');
    await check('a member still cannot read another members private profile', () => getDoc(doc(SE, 'userProfiles', OUTSIDER)), 'DENIED');
    await check('a member cannot read another members users doc', () => getDoc(doc(SE, 'users', OUTSIDER)), 'DENIED');

    console.log('\nF2. Connection state listener queries (equality-only merges)');
    await check('my direction: from == me AND to == them', () =>
      getDocs(query(collection(SE, 'connections'), where('from', '==', SEEKER), where('to', '==', OUTSIDER))), 'ALLOWED');
    await check('their direction: from == them AND to == me', () =>
      getDocs(query(collection(SE, 'connections'), where('from', '==', OUTSIDER), where('to', '==', SEEKER))), 'ALLOWED');
    await check('nobody can enumerate the whole connections collection', () =>
      getDocs(collection(SE, 'connections')), 'DENIED');

    console.log('\nG. Community posts: both roles can READ');
    await check('seeker can read the community feed', () => getDocs(collection(SE, 'posts')), 'ALLOWED');
    await check('COMPANY can read the community feed', () => getDocs(collection(CO, 'posts')), 'ALLOWED');
    await check('a company can create its own post', () =>
      setDoc(doc(CO, 'posts', 'p_co'), { authorId: COMPANY, content: 'hiring!', imageUrl: null, likes: [], commentCount: 0, createdAt: new Date() }), 'ALLOWED');
    await check('a company CANNOT create a post claiming another authorId', () =>
      setDoc(doc(CO, 'posts', 'p_bad'), { authorId: SEEKER, content: 'spoofed', likes: [], commentCount: 0, createdAt: new Date() }), 'DENIED');
    await check('a company CANNOT edit somebody elses post', () =>
      setDoc(doc(SE, 'posts', 'p_se'), { authorId: SEEKER, content: 'mine', likes: [], commentCount: 0, createdAt: new Date() })
        .then(() => updateDoc(doc(CO, 'posts', 'p_se'), { content: 'hacked' })), 'DENIED');
    await check('a company CANNOT delete somebody elses post', () =>
      setDoc(doc(SE, 'posts', 'p_se2'), { authorId: SEEKER, content: 'mine', likes: [], commentCount: 0, createdAt: new Date() })
        .then(() => deleteDoc(doc(CO, 'posts', 'p_se2'))), 'DENIED');
    await check('any signed-in member can like a post (likes array only)', () =>
      updateDoc(doc(CO, 'posts', 'p_se'), { likes: [COMPANY], updatedAt: new Date() }), 'ALLOWED');
    await check('a like cannot smuggle in other field changes', () =>
      updateDoc(doc(CO, 'posts', 'p_se'), { likes: [COMPANY], commentCount: 99 }), 'DENIED');
    await check('any signed-in member can comment', () =>
      setDoc(doc(CO, 'posts', 'p_se', 'comments', 'cm1'), { authorId: COMPANY, authorName: 'Co', text: 'hi', createdAt: new Date() }), 'ALLOWED');
    await check('a comment CANNOT spoof another authorId', () =>
      setDoc(doc(CO, 'posts', 'p_se', 'comments', 'cm2'), { authorId: SEEKER, authorName: 'Spoof', text: 'hi', createdAt: new Date() }), 'DENIED');

    console.log(`\n############ RESULT: ${pass} passed, ${fail} failed ############\n`);
  } finally {
    await testEnv.cleanup();
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
