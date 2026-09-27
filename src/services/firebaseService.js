import {
  collection, addDoc, getDocs, getDoc, setDoc, doc, query, where,
  orderBy, serverTimestamp, updateDoc, deleteDoc, onSnapshot,
  limit, startAfter
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';

// ========== SHARED HELPERS ==========
/**
 * Sort a list of documents by a Firestore timestamp field, newest first.
 * Works with Timestamp objects, {seconds}, ISO strings and numbers, and is used
 * as the fallback whenever a composite index is not available yet.
 */
const sortByTimestampDesc = (items, field) => {
  return items.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    const aTime = aVal?.toMillis ? aVal.toMillis() : (aVal?.seconds ? aVal.seconds * 1000 : (aVal ? new Date(aVal).getTime() : 0));
    const bTime = bVal?.toMillis ? bVal.toMillis() : (bVal?.seconds ? bVal.seconds * 1000 : (bVal ? new Date(bVal).getTime() : 0));
    return bTime - aTime;
  });
};

/** Turn a raw Firestore error into something worth showing a user. */
const describeFirebaseError = (error, fallback) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'You do not have permission to do that. Please sign in again and try.';
    case 'unauthenticated':
    case 'auth/requires-recent-login':
      return 'Your session has expired. Please sign in again.';
    case 'unavailable':
      return 'Network problem. Check your connection and try again.';
    case 'deadline-exceeded':
      return 'The request timed out. Please try again.';
    case 'resource-exhausted':
    case 'quota-exceeded':
      return 'Too many requests right now. Please wait a moment and try again.';
    case 'failed-precondition':
      return 'A database index is still building. Please try again in a minute.';
    case 'already-exists':
      return 'That item already exists.';
    default:
      return error?.message || fallback;
  }
};

// ========== JOBS ==========
export const fetchJobs = async () => {
  const q = query(collection(db, 'jobs'), orderBy('postedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Live job feed. A one-shot fetch left the seeker staring at a stale list until
 * a manual refresh, so a newly posted job was effectively invisible.
 * Search and filtering still run client-side over this authorized list.
 */
export const subscribeToJobs = (callback, onError) => {
  const emit = (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  try {
    const q = query(collection(db, 'jobs'), orderBy('postedAt', 'desc'));
    return onSnapshot(q, emit, (error) => {
      if (error?.code === 'failed-precondition') {
        // Composite index not built yet; the unordered feed still works.
        const fallbackQ = query(collection(db, 'jobs'));
        return onSnapshot(fallbackQ, (snap) =>
          callback(sortByTimestampDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'postedAt')),
          (fallbackError) => {
            console.error('subscribeToJobs error:', fallbackError);
            onError?.(describeFirebaseError(fallbackError, 'Failed to load jobs.'));
          }
        );
      }
      console.error('subscribeToJobs error:', error);
      onError?.(describeFirebaseError(error, 'Failed to load jobs.'));
      return () => {};
    });
  } catch (error) {
    console.error('subscribeToJobs error:', error);
    onError?.(describeFirebaseError(error, 'Failed to load jobs.'));
    return () => {};
  }
};

export const fetchCompanyJobs = async (companyUid) => {
  try {
    const q = query(
      collection(db, 'jobs'),
      where('postedBy', '==', companyUid),
      orderBy('postedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'failed-precondition') {
      const q = query(
        collection(db, 'jobs'),
        where('postedBy', '==', companyUid)
      );
      const snap = await getDocs(q);
      const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortByTimestampDesc(jobs, 'postedAt');
    }
    throw error;
  }
};

export const subscribeToCompanyJobs = (companyUid, callback) => {
  try {
    const q = query(
      collection(db, 'jobs'),
      where('postedBy', '==', companyUid),
      orderBy('postedAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(jobs);
    }, (error) => {
      if (error?.code === 'failed-precondition') {
        const fallbackQ = query(
          collection(db, 'jobs'),
          where('postedBy', '==', companyUid)
        );
        return onSnapshot(fallbackQ, (snap) => {
          const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(sortByTimestampDesc(jobs, 'postedAt'));
        });
      }
      console.error('subscribeToCompanyJobs error:', error);
    });
  } catch (error) {
    const fallbackQ = query(
      collection(db, 'jobs'),
      where('postedBy', '==', companyUid)
    );
    return onSnapshot(fallbackQ, (snap) => {
      const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(sortByTimestampDesc(jobs, 'postedAt'));
    });
  }
};

export const fetchJobById = async (jobId) => {
  const snap = await getDoc(doc(db, 'jobs', jobId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ========== JOBS: STRUCTURED SCHEMA ==========
// One consistent shape across create / edit / cards / details / filters.
//   existing : title, company, location, salary, description,
//              postedBy, postedByName, postedByPhoto, postedAt, updatedAt
//   added    : workType, workMode, category, salaryMin, salaryMax,
//              experienceLevel, skills[], requirements
// Older job documents simply do not have the new fields; readers use the
// tolerant helpers in src/utils/jobFilters.js so nothing breaks.
//
// The categorised fields are validated against the application vocabularies in
// src/utils/jobFilters.js, so a posting can never invent a brand new filter
// option that the seeker menus would then have to offer.
import {
  WORK_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  JOB_CATEGORIES
} from '../utils/jobFilters';

export const JOB_WORK_TYPES = WORK_TYPES;
export const JOB_EXPERIENCE_LEVELS = EXPERIENCE_LEVELS;
export const JOB_WORK_MODES = WORK_MODES;
export const JOB_CATEGORIES_LIST = JOB_CATEGORIES;

const cleanString = (value, maxLength = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

/** Validate + normalise raw form input into the stored job schema. */
export const buildJobPayload = (input = {}) => {
  const problems = [];
  const title = cleanString(input.title, 120);
  const company = cleanString(input.company, 120);
  const location = cleanString(input.location, 120);
  const description = cleanString(input.description, 5000);
  const requirements = cleanString(input.requirements, 5000);

  // workType: accept either the new key or the legacy `type` field.
  // Matching is case-insensitive so a hand-built payload still lands on the
  // canonical vocabulary value.
  const pickFrom = (value, list) => {
    const raw = cleanString(value, 40);
    if (!raw) return '';
    return list.find((entry) => entry.toLowerCase() === raw.toLowerCase()) || '';
  };
  const workType = pickFrom(input.workType || input.type, WORK_TYPES);
  const experienceLevel = pickFrom(input.experienceLevel, EXPERIENCE_LEVELS);
  const workMode = pickFrom(input.workMode, WORK_MODES);
  const category = pickFrom(input.category, JOB_CATEGORIES);

  const skills = (Array.isArray(input.skills) ? input.skills : [])
    .map(s => cleanString(s, 40))
    .filter(Boolean)
    .slice(0, 20);

  const toNumber = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  let salaryMin = toNumber(input.salaryMin);
  let salaryMax = toNumber(input.salaryMax);
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    [salaryMin, salaryMax] = [salaryMax, salaryMin];
  }

  const remote = input.remote === true || input.remote === 'true';

  if (!title) problems.push('Job title is required.');
  if (!company) problems.push('Company name is required.');
  if (!location) problems.push('Location is required.');
  if (!workType) problems.push('Work type is required.');
  if (!workMode) problems.push('Work mode is required.');
  if (!category) problems.push('Job category is required.');
  if (!experienceLevel) problems.push('Experience level is required.');
  if (!description) problems.push('Job description is required.');
  if (skills.length === 0) problems.push('Add at least one required skill.');
  if (salaryMin === null && salaryMax === null) {
    problems.push('Enter a minimum and/or maximum salary.');
  }

  if (problems.length > 0) {
    const err = new Error(problems[0]);
    err.problems = problems;
    throw err;
  }

  // Keep the existing free-text `salary` field in sync for the card/details
  // display, so older UI and older jobs keep rendering the same way.
  const formatMoney = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  let salary = cleanString(input.salary, 60);
  if (!salary) {
    if (salaryMin !== null && salaryMax !== null) salary = `${formatMoney(salaryMin)} - ${formatMoney(salaryMax)}`;
    else if (salaryMin !== null) salary = `${formatMoney(salaryMin)}+`;
    else if (salaryMax !== null) salary = `Up to ${formatMoney(salaryMax)}`;
  }

  return {
    title,
    company,
    location,
    description,
    requirements,
    workType,
    // `type` was already rendered on job cards - keep it for compatibility.
    type: workType,
    workMode,
    category,
    // `remote` predates `workMode`; keep it in step so old readers still work.
    remote: remote || workMode === 'Remote',
    salary,
    salaryMin,
    salaryMax,
    experienceLevel,
    skills,
    // accept the legacy field name too
    ...(input.logoUrl ? { logoUrl: cleanString(input.logoUrl, 500) } : {})
  };
};

export const createJob = async (jobData, userId) => {
  const payload = buildJobPayload(jobData);
  const data = {
    ...payload,
    postedBy: userId,
    postedByName: auth.currentUser?.displayName || '',
    postedByPhoto: auth.currentUser?.photoURL || '',
    postedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'jobs'), data);
  return ref.id;
};

export const updateJob = async (jobId, data) => {
  const payload = buildJobPayload(data);
  await updateDoc(doc(db, 'jobs', jobId), {
    ...payload,
    updatedAt: serverTimestamp()
  });
};

export const deleteJob = async (jobId) => {
  await deleteDoc(doc(db, 'jobs', jobId));
};

// ========== APPLICATIONS ==========
export const applyToJob = async (jobId, jobTitle, companyName, coverLetter, resumeUrl, resumeFileName) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const jobSnap = await getDoc(doc(db, 'jobs', jobId));
  if (!jobSnap.exists()) throw new Error('Job not found');

  // Guard against duplicate applications even if the UI is bypassed.
  const existing = await getDocs(query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    where('applicantUid', '==', user.uid)
  ));
  if (!existing.empty) {
    throw new Error('You have already applied to this job.');
  }

  const job = jobSnap.data();
  const applicationData = {
    jobId,
    jobTitle,
    companyName,
    companyUid: job.postedBy,
    applicantUid: user.uid,
    applicantName: user.displayName || user.email,
    applicantEmail: user.email,
    applicantPhoto: user.photoURL || '',
    coverLetter,
    resumeUrl,
    resumeFileName,
    status: 'pending',
    appliedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'applications'), applicationData);
  await notifyQuietly(
    job.postedBy,
    user.uid,
    'job_application',
    `New application for ${job.title || 'your job'}.`,
    ref.id,
    'application'
  );
  return ref.id;
};

export const fetchUserApplications = async (userId) => {
  try {
    const q = query(
      collection(db, 'applications'),
      where('applicantUid', '==', userId),
      orderBy('appliedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'failed-precondition') {
      const q = query(
        collection(db, 'applications'),
        where('applicantUid', '==', userId)
      );
      const snap = await getDocs(q);
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortByTimestampDesc(apps, 'appliedAt');
    }
    throw error;
  }
};

export const fetchCompanyApplications = async (companyUid) => {
  try {
    const q = query(
      collection(db, 'applications'),
      where('companyUid', '==', companyUid),
      orderBy('appliedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'failed-precondition') {
      const q = query(
        collection(db, 'applications'),
        where('companyUid', '==', companyUid)
      );
      const snap = await getDocs(q);
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortByTimestampDesc(apps, 'appliedAt');
    }
    throw error;
  }
};

export const fetchJobApplications = async (jobId, companyUid) => {
  try {
    const q = query(
      collection(db, 'applications'),
      where('jobId', '==', jobId),
      where('companyUid', '==', companyUid),
      orderBy('appliedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'failed-precondition') {
      const q = query(
        collection(db, 'applications'),
        where('jobId', '==', jobId),
        where('companyUid', '==', companyUid)
      );
      const snap = await getDocs(q);
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortByTimestampDesc(apps, 'appliedAt');
    }
    throw error;
  }
};

export const updateApplicationStatus = async (applicationId, status) => {
  const ref = doc(db, 'applications', applicationId);
  // Read first so the applicant can be told about the decision.
  const before = await getDoc(ref);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp()
  });
  const app = before.data();
  if (app?.applicantUid) {
    const label = status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Updated';
    await notifyQuietly(
      app.applicantUid,
      app.companyUid,
      'application_status',
      `Your application for ${app.jobTitle || 'a job'} was ${label.toLowerCase()}.`,
      applicationId,
      'application'
    );
  }
};

export const subscribeToApplications = (userId, callback, onError) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const emit = (snap) => {
    const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(apps);
  };
  try {
    const q = query(
      collection(db, 'applications'),
      where('applicantUid', '==', userId),
      orderBy('appliedAt', 'desc')
    );
    return onSnapshot(q, emit, (error) => {
      if (error?.code === 'failed-precondition') {
        // The composite index is not built yet; equality-only still works.
        const fallbackQ = query(
          collection(db, 'applications'),
          where('applicantUid', '==', userId)
        );
        return onSnapshot(fallbackQ, (snap) =>
          callback(sortByTimestampDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'appliedAt')),
          (fallbackError) => {
            console.error('subscribeToApplications error:', fallbackError);
            onError?.(describeFirebaseError(fallbackError, 'Could not load your applications.'));
          }
        );
      }
      console.error('subscribeToApplications error:', error);
      onError?.(describeFirebaseError(error, 'Could not load your applications.'));
      return () => {};
    });
  } catch (error) {
    console.error('subscribeToApplications error:', error);
    onError?.(describeFirebaseError(error, 'Could not load your applications.'));
    return () => {};
  }
};

export const subscribeToCompanyApplications = (companyUid, callback, onError) => {
  if (!companyUid) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(
      collection(db, 'applications'),
      where('companyUid', '==', companyUid),
      orderBy('appliedAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(apps);
    }, (error) => {
      if (error?.code === 'failed-precondition') {
        const fallbackQ = query(
          collection(db, 'applications'),
          where('companyUid', '==', companyUid)
        );
        return onSnapshot(fallbackQ, (snap) =>
          callback(sortByTimestampDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'appliedAt')),
          (fallbackError) => {
            console.error('subscribeToCompanyApplications error:', fallbackError);
            onError?.(describeFirebaseError(fallbackError, 'Could not load applications.'));
          }
        );
      }
      console.error('subscribeToCompanyApplications error:', error);
      onError?.(describeFirebaseError(error, 'Could not load applications.'));
      return () => {};
    });
  } catch (error) {
    console.error('subscribeToCompanyApplications error:', error);
    onError?.(describeFirebaseError(error, 'Could not load applications.'));
    return () => {};
  }
};

// ========== ROLES / ACCOUNT SEPARATION ==========
// One email address = one role. The authoritative role lives in the Firestore
// document `users/{uid}`; `localStorage.jobsphere_role` is only a UI hint.
//
// Firestore security rules (see firestore.rules) only let a signed-in caller
// query /users filtered by their OWN email address, so the lookups below can
// only ever return documents that already belong to the caller's own email.

/**
 * Every `users` document that exists for the currently signed-in user's OWN
 * email address (their own document plus any sibling account created for the
 * same email, e.g. an old Google + password pair).
 *
 * @returns {Promise<Array|null>} the accounts, or `null` when the lookup could
 *   not run because the security rules have not been deployed yet.
 */
export const findAccountsByEmail = async (email) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (!email) return [];

  const target = String(email).trim().toLowerCase();
  const own = String(user.email || '').trim().toLowerCase();
  if (!own || target !== own) {
    // Defensive only: the rules would reject this anyway, so never even try.
    throw new Error('You can only look up accounts for your own email address.');
  }

  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', user.email),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'permission-denied') {
      // Fail OPEN so a rules regression can never lock every user out of
      // signing in. The `allow list` grant for this query is in firestore.rules
      // and IS deployed; this branch is only a safety net, and it logs loudly
      // because an unverified check silently disables one-email-one-role.
      console.error(
        'Role check unavailable: confirm firestore.rules is deployed to enforce one email = one role.',
        error
      );
      return null;
    }
    throw error;
  }
};

/**
 * Is the account that just authenticated trying to take a role that the same
 * email address already holds under a DIFFERENT account?
 *
 * @returns {Promise<{verified: boolean, role: string|null}>}
 *   verified=false -> the check could not run (rules not deployed).
 *   role -> the already-taken role when there is a conflict.
 */
export const findConflictingRole = async (email, desiredRole) => {
  const accounts = await findAccountsByEmail(email);
  if (accounts === null) return { verified: false, role: null };

  const myUid = auth.currentUser?.uid;
  const conflict = accounts.find(
    a => a.uid !== myUid && a.role && a.role !== desiredRole
  );
  return { verified: true, role: conflict?.role || null };
};

/**
 * Create the authoritative `users/{uid}` document for the signed-in account.
 * `role` is the field every role check in the app reads.
 */
export const createAccountProfile = async ({ role, name, photo }) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (role !== 'company' && role !== 'user') {
    throw new Error('Unknown account type.');
  }

  const displayName =
    name || user.displayName || (user.email || 'User').split('@')[0];

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    name: displayName,
    photo:
      photo ||
      user.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`,
    role,
    createdAt: serverTimestamp()
  });

  return user.uid;
};

// ========== USERS & PROFILES ==========
/**
 * Read a member's profile.
 *
 * `users` and `userProfiles` are owner-only by design, so another member's
 * documents cannot (and must not) be read. For anyone other than the signed-in
 * user this falls back to the public `userDirectory` projection, which holds
 * only the fields a member has chosen to publish publicly.
 *
 * Returns { uid, name, photo, role, profile, isPublic, isSelf }.
 */
export const fetchUserProfile = async (uid) => {
  if (!uid) return null;
  const current = auth.currentUser;
  const isSelf = current?.uid === uid;

  // Public projection: readable for anybody signed in.
  const directorySnap = await getDoc(doc(db, 'userDirectory', uid));
  const directory = directorySnap.exists() ? directorySnap.data() : null;

  // Own account: the full, private record is readable too.
  if (isSelf) {
    const [userSnap, profSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'userProfiles', uid))
    ]);
    const own = userSnap.exists() ? userSnap.data() : null;
    if (!own && !directory) return null;
    return {
      uid,
      name: own?.name || directory?.name || current?.displayName || 'Member',
      photo: own?.photo || directory?.photo || current?.photoURL || '',
      role: own?.role || directory?.role || '',
      // The email is only ever included for the signed-in user's own profile.
      ...(own?.email ? { email: own.email } : {}),
      profile: profSnap.exists() ? profSnap.data() : (directory || {}),
      directory: directory || null,
      isPublic: false,
      isSelf: true
    };
  }

  // Another member: public fields only, never the email.
  if (!directory) return null;
  return {
    uid,
    name: directory.name || 'Member',
    photo: directory.photo || '',
    role: directory.role || '',
    profile: {
      jobTitle: directory.jobTitle || '',
      company: directory.company || '',
      headline: directory.headline || '',
      bio: directory.bio || '',
      skills: Array.isArray(directory.skills) ? directory.skills : [],
      location: directory.location || '',
      experience: directory.experience || '',
      degree: directory.degree || '',
      institution: directory.institution || '',
      linkedin: directory.linkedin || '',
      github: directory.github || '',
      portfolio: directory.portfolio || ''
    },
    directory,
    isPublic: true,
    isSelf: false
  };
};

export const updateUserProfile = async (uid, profileData) => {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('You can only edit your own profile.');

  // The email is the authentication identity and is owned by Firebase Auth.
  // It is never rewritten from the form; showing it in the profile is enough.
  const {
    email: _ignoredEmail,
    photoUrl,
    fullName,
    ...rest
  } = profileData || {};

  const data = {
    ...rest,
    uid,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'userProfiles', uid), data, { merge: true });

  // Keep the `users` document in step (name/photo are read from there).
  const userPatch = {};
  if (typeof fullName === 'string' && fullName.trim()) userPatch.name = fullName.trim();
  if (typeof photoUrl === 'string') userPatch.photo = photoUrl;
  if (Object.keys(userPatch).length > 0) {
    await setDoc(doc(db, 'users', uid), userPatch, { merge: true });
  }

  // Republish the public projection so Find People reflects the edit at once.
  try {
    const [userSnap, profileSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'userProfiles', uid))
    ]);
    await syncUserDirectoryEntry(
      userSnap.exists() ? userSnap.data() : null,
      profileSnap.exists() ? profileSnap.data() : null
    );
  } catch (error) {
    console.warn('Profile saved, but the public directory entry could not be refreshed:', error);
  }
};

export const fetchCurrentUserProfile = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return fetchUserProfile(user.uid);
};

// ========== POSTS ==========
/**
 * Create a community post.
 *
 * Schema (unchanged, matches the existing `posts` collection):
 *   authorId, authorName, authorPhoto, content, imageUrl,
 *   likes[], commentCount, createdAt, updatedAt
 *
 * @param {string}  content                post text (may be empty if an image is attached)
 * @param {string|null} imageUrl           Cloudinary URL of the uploaded image
 * @param {{name?: string, photo?: string}} [author]  fallback author info from the user profile doc
 * @returns {Promise<string>} the new post id
 */
export const createPost = async (content, imageUrl = null, author = {}) => {
  const user = auth.currentUser;
  if (!user) throw new Error('You need to be signed in to create a post.');

  const trimmedContent = typeof content === 'string' ? content.trim() : '';
  const trimmedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';

  if (!trimmedContent && !trimmedImageUrl) {
    throw new Error('Add some text or an image before posting.');
  }

  const postData = {
    authorId: user.uid,
    authorName: user.displayName || author.name || user.email || 'User',
    authorPhoto: user.photoURL || author.photo || '',
    content: trimmedContent,
    imageUrl: trimmedImageUrl || null,
    likes: [],
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const ref = await addDoc(collection(db, 'posts'), postData);
    return ref.id;
  } catch (error) {
    console.error('createPost error:', error);
    throw new Error(describeFirebaseError(error, 'Failed to create post. Please try again.'));
  }
};

export const fetchPosts = async (lastDoc = null, pageSize = 10) => {
  let q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize)
    );
  }

  const snap = await getDocs(q);
  const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const lastVisible = snap.docs[snap.docs.length - 1] || null;
  return { posts, lastVisible };
};

export const fetchUserPosts = async (userId) => {
  const q = query(
    collection(db, 'posts'),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const likePost = async (postId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Post not found');

  const post = postSnap.data();
  const likes = post.likes || [];
  const isLiked = likes.includes(user.uid);

  if (isLiked) {
    await updateDoc(postRef, {
      likes: likes.filter(id => id !== user.uid),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(postRef, {
      likes: [...likes, user.uid],
      updatedAt: serverTimestamp()
    });
  }

  return !isLiked;
};

export const fetchPostComments = async (postId) => {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addComment = async (postId, text) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  await addDoc(collection(db, 'posts', postId, 'comments'), {
    text,
    authorId: user.uid,
    authorName: user.displayName || user.email,
    authorPhoto: user.photoURL || '',
    createdAt: serverTimestamp()
  });

  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  const currentCount = postSnap.data()?.commentCount || 0;
  await updateDoc(postRef, { commentCount: currentCount + 1 });
};

export const deletePost = async (postId) => {
  await updateDoc(doc(db, 'posts', postId), {
    deleted: true,
    updatedAt: serverTimestamp()
  });
};

/**
 * Live community feed, newest first.
 * `orderBy('createdAt')` on a single field uses the built-in index,
 * so no composite index is required.
 */
export const subscribeToPosts = (callback, onError) => {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.deleted);
      callback(posts);
    },
    (error) => {
      console.error('subscribeToPosts error:', error);
      if (onError) {
        onError(describeFirebaseError(error, 'Failed to load the community feed.'));
      }
    }
  );
};

// ========== CONNECTIONS ==========
/**
 * Find people to connect with.
 *
 * Searches the `userDirectory` projection (name + jobTitle) rather than
 * `users`, because `users` holds every member's email address and the security
 * rules correctly refuse to expose it. See firestore.rules.
 */
/**
 * Find people to connect with, by any PUBLISHED field.
 *
 * The member directory is a small, already-authorized collection, so the
 * search is done client side over it. That is deliberate: Firestore can only
 * do prefix range queries, which means "tooling" would never match a bio that
 * merely contains the word. This is the same approach already used for the
 * job search, and it keeps results predictable.
 *
 * A `contains` style search engine (Algolia/Typesense) would be the next step
 * if the directory ever grows to thousands of members.
 */
export const searchUsers = async (searchTerm, currentUid) => {
  const term = typeof searchTerm === 'string' ? searchTerm.trim() : '';
  if (!term) return [];

  const all = await readDirectory();
  if (all.length === 0) return [];

  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];

  for (const entry of all) {
    const uid = entry.uid || entry.id;
    if (!uid || uid === currentUid) continue;

    const skills = Array.isArray(entry.skills) ? entry.skills.join(' ') : (entry.skillsText || '');
    const haystack = [
      entry.name,
      entry.jobTitle,
      entry.company,
      entry.headline,
      entry.bio,
      entry.location,
      entry.experience,
      skills
    ]
      .filter(Boolean)
      .join(' | ')
      .toLowerCase();

    // Every typed word must appear somewhere, so extra words only narrow.
    if (!words.every(word => haystack.includes(word))) continue;

    // Rank: a name that starts with the term beats a hit buried in a bio.
    const name = (entry.name || '').toLowerCase();
    const rank = name.startsWith(words[0]) ? 0 : (name.includes(words[0]) ? 1 : 2);
    scored.push({ rank, entry: { ...entry, uid } });
  }

  return scored
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 20)
    .map(item => item.entry);
};

/** One read of the whole (authorized, public-only) member directory. */
const readDirectory = async (max = 200) => {
  try {
    const snap = await getDocs(query(collection(db, 'userDirectory'), limit(max)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Could not read the member directory:', error);
    return [];
  }
};

/**
 * Browse the member directory, most recently updated first.
 * Used to show suggestions before a search term is typed.
 */
export const browseDirectory = async (currentUid, max = 24) => {
  const all = await readDirectory();
  const timeOf = (entry) => {
    const t = entry.updatedAt;
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
    const parsed = new Date(t).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return all
    .filter(entry => (entry.uid || entry.id) !== currentUid)
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, max);
};

/**
 * Public fields a member publishes about themselves.
 * Deliberately excludes email, phone, date of birth, nationality and any
 * resume/document link - none of that may become readable by other members.
 */
const toDirectoryEntry = (uid, userDoc, profileDoc, authUser) => {
  const skills = Array.isArray(profileDoc?.skills) ? profileDoc.skills : [];
  const skillsText = skills.filter(Boolean).join(', ');
  return {
    uid,
    name: userDoc?.name || authUser?.displayName || (authUser?.email || '').split('@')[0] || 'Member',
    photo: userDoc?.photo || authUser?.photoURL || '',
    role: userDoc?.role || '',
    jobTitle: profileDoc?.jobTitle || '',
    company: userDoc?.company || profileDoc?.company || '',
    headline: profileDoc?.headline || profileDoc?.bio?.slice(0, 140) || '',
    bio: profileDoc?.bio || '',
    skills,
    skillsText,
    location: profileDoc?.location || '',
    experience: profileDoc?.experience || '',
    degree: profileDoc?.degree || '',
    institution: profileDoc?.institution || '',
    linkedin: profileDoc?.linkedin || '',
    github: profileDoc?.github || '',
    portfolio: profileDoc?.portfolio || '',
    updatedAt: serverTimestamp()
  };
};

const DIRECTORY_PUBLIC_FIELDS = Object.keys(toDirectoryEntry('x', {}, {}, null))
  .filter(key => key !== 'updatedAt');

/**
 * Publish (or refresh) this member's own public directory entry.
 *
 * This is the self-healing strategy that makes "Find People" work for accounts
 * that were created before the directory existed: the entry is (re)written from
 * the signed-in member's own documents, so simply signing in is enough - no
 * separate migration step and no access to anybody else's data.
 */
export const syncUserDirectoryEntry = async (userDoc, profileDoc) => {
  const user = auth.currentUser;
  if (!user || !userDoc) return null;

  const next = toDirectoryEntry(user.uid, userDoc, profileDoc, user);

  const ref = doc(db, 'userDirectory', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const current = snap.data();
      // Skip the write when nothing public actually changed.
      const unchanged = DIRECTORY_PUBLIC_FIELDS.every((field) => {
        const a = current[field];
        const b = next[field];
        if (Array.isArray(a) || Array.isArray(b)) {
          return JSON.stringify(a || []) === JSON.stringify(b || []);
        }
        return (a || '') === (b || '');
      });
      if (unchanged) return user.uid;
    }

    await setDoc(ref, next);
    return user.uid;
  } catch (error) {
    // Never block sign-in because the optional directory write failed.
    console.warn('Could not update the member directory entry:', error);
  }
  return user.uid;
};

/**
 * Live connection state between two specific members.
 *
 * Emits { status, connectionId } where status is one of:
 *   'none'     - no connection document
 *   'sent'     - I sent the request and it is still pending
 *   'received' - they sent a request that I can accept or decline
 *   'accepted' - connected
 *   'rejected' - declined
 *
 * Two equality-only listeners (one per direction) are merged, which avoids the
 * "either side" disjunction that Firestore rules cannot express in a query.
 */
export const subscribeToConnectionWith = (myUid, otherUid, callback, onError) => {
  if (!myUid || !otherUid) {
    callback({ status: 'none', connectionId: null });
    return () => {};
  }

  const base = (direction) => query(
    collection(db, 'connections'),
    where(direction, '==', myUid),
    where('to', '==', otherUid)
  );
  const baseReverse = query(
    collection(db, 'connections'),
    where('from', '==', otherUid),
    where('to', '==', myUid)
  );

  let mine = null;
  let theirs = null;
  let mineReady = false;
  let theirsReady = false;

  const publish = () => {
    if (!mineReady || !theirsReady) return;
    // Accepted wins over pending; my own pending request outranks theirs.
    const accepted = [mine, theirs].find(c => c?.status === 'accepted');
    if (accepted) {
      callback({ status: 'accepted', connectionId: accepted.id });
      return;
    }
    if (mine && mine.status === 'pending') {
      callback({ status: 'sent', connectionId: mine.id });
      return;
    }
    if (theirs && theirs.status === 'pending') {
      callback({ status: 'received', connectionId: theirs.id });
      return;
    }
    if (mine?.status === 'rejected' || theirs?.status === 'rejected') {
      callback({ status: 'rejected', connectionId: (mine || theirs).id });
      return;
    }
    callback({ status: 'none', connectionId: null });
  };

  const fail = (error) => {
    console.error('subscribeToConnectionWith error:', error);
    onError?.(describeFirebaseError(error, 'Could not load the connection status.'));
  };

  const unsubscribers = [
    onSnapshot(base('from'), (snap) => {
      mine = snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
      mineReady = true;
      publish();
    }, fail),
    onSnapshot(baseReverse, (snap) => {
      theirs = snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
      theirsReady = true;
      publish();
    }, fail)
  ];

  return () => {
    unsubscribers.forEach((fn) => {
      try { fn(); } catch (error) { console.error('Cleanup error:', error); }
    });
  };
};

/** The other side of a connection request (who is not me). */
export const getConnectionPeer = (connection, myUid) => {
  if (!connection) return { uid: null, name: 'User', photo: '' };
  const iAmSender = connection.from === myUid;
  const otherUid = iAmSender ? connection.to : connection.from;
  return {
    uid: otherUid || null,
    // The connections schema stores fromName/toName (not a generic `name`).
    name: (iAmSender ? connection.toName : connection.fromName) || connection.name || 'User',
    photo: (iAmSender ? connection.toPhoto : connection.fromPhoto) || connection.photo || ''
  };
};

export const sendConnectionRequest = async (toUid, toName, toPhoto) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (!toUid) throw new Error('No recipient was selected.');
  if (toUid === user.uid) throw new Error('You cannot send a connection request to yourself.');

  const existing = await getDocs(query(
    collection(db, 'connections'),
    where('from', '==', user.uid),
    where('to', '==', toUid)
  ));

  if (!existing.empty) {
    const conn = existing.docs[0].data();
    if (conn.status === 'pending') throw new Error('Request already sent');
    if (conn.status === 'accepted') throw new Error('Already connected');
  }

  const reverse = await getDocs(query(
    collection(db, 'connections'),
    where('from', '==', toUid),
    where('to', '==', user.uid)
  ));

  if (!reverse.empty) {
    const conn = reverse.docs[0].data();
    if (conn.status === 'pending') throw new Error('They already sent you a request');
    if (conn.status === 'accepted') throw new Error('Already connected');
  }

  // The sender's display name: Firebase Auth leaves `displayName` null for
  // email/password sign-ups, which previously made every request show up as a
  // raw email address. Fall back to the public directory / users document.
  const senderName = await (async () => {
    if (user.displayName) return user.displayName;
    try {
      const [dirSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'userDirectory', user.uid)),
        getDoc(doc(db, 'users', user.uid))
      ]);
      return (dirSnap.exists() && dirSnap.data()?.name)
        || (userSnap.exists() && userSnap.data()?.name)
        || (user.email || '').split('@')[0]
        || 'Member';
    } catch {
      return (user.email || '').split('@')[0] || 'Member';
    }
  })();
  const senderPhoto = user.photoURL
    || (await (async () => {
      try {
        const dirSnap = await getDoc(doc(db, 'userDirectory', user.uid));
        return (dirSnap.exists() && dirSnap.data()?.photo) || '';
      } catch {
        return '';
      }
    })());

  const connectionData = {
    from: user.uid,
    fromName: senderName,
    fromPhoto: senderPhoto,
    to: toUid,
    toName,
    toPhoto,
    status: 'pending',
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'connections'), connectionData);
  await notifyQuietly(
    toUid,
    user.uid,
    'connection_request',
    `${senderName} wants to connect with you.`,
    ref.id,
    'connection'
  );
  return ref.id;
};

export const acceptConnection = async (connectionId) => {
  const ref = doc(db, 'connections', connectionId);
  // Read first so the acceptance can be announced to the other party.
  const before = await getDoc(ref);
  await updateDoc(ref, {
    status: 'accepted',
    updatedAt: serverTimestamp()
  });
  const conn = before.data();
  if (conn?.from && conn?.to) {
    const me = auth.currentUser?.uid;
    const other = me === conn.from ? conn.to : conn.from;
    const myName = me === conn.from ? conn.fromName : conn.toName;
    await notifyQuietly(
      other,
      me,
      'connection_accepted',
      `${myName || 'Someone'} accepted your connection request.`,
      connectionId,
      'connection'
    );
  }
};

export const rejectConnection = async (connectionId) => {
  await deleteDoc(doc(db, 'connections', connectionId));
};

export const cancelConnectionRequest = async (connectionId) => {
  await deleteDoc(doc(db, 'connections', connectionId));
}

export const fetchReceivedRequests = async (uid) => {
  const q = query(
    collection(db, 'connections'),
    where('to', '==', uid),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchSentRequests = async (uid) => {
  const q = query(
    collection(db, 'connections'),
    where('from', '==', uid),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchConnections = async (uid) => {
  const [sent, received] = await Promise.all([
    getDocs(query(
      collection(db, 'connections'),
      where('from', '==', uid),
      where('status', '==', 'accepted')
    )),
    getDocs(query(
      collection(db, 'connections'),
      where('to', '==', uid),
      where('status', '==', 'accepted')
    ))
  ]);

  const connections = [];
  sent.docs.forEach(d => connections.push({ id: d.id, ...d.data(), direction: 'sent' }));
  received.docs.forEach(d => connections.push({ id: d.id, ...d.data(), direction: 'received' }));

  return connections;
};

/**
 * Live accepted-connection list. Two listeners (sent + received) are merged so
 * a connection shows up the moment the other person accepts, instead of only
 * after a manual refresh.
 */
export const subscribeToConnections = (uid, callback, onError) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  // Receives already-mapped connection objects (not document snapshots).
  const merge = (sentList, receivedList) => [...sentList, ...receivedList];

  const sentQuery = query(
    collection(db, 'connections'),
    where('from', '==', uid),
    where('status', '==', 'accepted')
  );
  const receivedQuery = query(
    collection(db, 'connections'),
    where('to', '==', uid),
    where('status', '==', 'accepted')
  );

  let sentDocs = [];
  let receivedDocs = [];
  let sentReady = false;
  let receivedReady = false;
  const publish = () => {
    if (sentReady && receivedReady) callback(merge(sentDocs, receivedDocs));
  };
  const onFail = (error) => {
    console.error('subscribeToConnections error:', error);
    onError?.(describeFirebaseError(error, 'Could not load your connections.'));
  };

  const unsubscribeSent = onSnapshot(sentQuery, (snap) => {
    sentDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), direction: 'sent' }));
    sentReady = true;
    publish();
  }, onFail);

  const unsubscribeReceived = onSnapshot(receivedQuery, (snap) => {
    receivedDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), direction: 'received' }));
    receivedReady = true;
    publish();
  }, onFail);

  return () => {
    try { unsubscribeSent(); } catch (error) { console.error('Cleanup error:', error); }
    try { unsubscribeReceived(); } catch (error) { console.error('Cleanup error:', error); }
  };
};

export const fetchUserConnections = async (uid) => {
  return fetchConnections(uid);
};

export const subscribeToReceivedRequests = (uid, callback, onError) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'connections'),
    where('to', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(sortByTimestampDesc(requests, 'createdAt'));
  }, (error) => {
    console.error('subscribeToReceivedRequests error:', error);
    onError?.(describeFirebaseError(error, 'Could not load connection requests.'));
  });
};

export const subscribeToSentRequests = (uid, callback, onError) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'connections'),
    where('from', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(sortByTimestampDesc(requests, 'createdAt'));
  }, (error) => {
    console.error('subscribeToSentRequests error:', error);
    onError?.(describeFirebaseError(error, 'Could not load your sent requests.'));
  });
};

// ========== CHATS ==========
// Schema (unchanged):
//   chats/{dm_<uidA>_<uidB>}          participants[], participantNames{}, participantPhotos{},
//                                       lastMessage, lastMessageAt, createdAt, updatedAt
//   chats/{chatId}/messages/{msgId}    text, senderUid, senderName, sentAt
//
// The chat id is derived from the two uids, so a pair can never end up with two
// conversations: opening a chat again always reuses the same document.
export const MAX_MESSAGE_LENGTH = 4000;

export const getDirectChatId = (uid1, uid2) => {
  return uid1 < uid2 ? `dm_${uid1}_${uid2}` : `dm_${uid2}_${uid1}`;
};

/** The other side of a conversation, with a usable name/photo. */
export const getOtherParticipant = (chat, myUid) => {
  const participants = Array.isArray(chat?.participants) ? chat.participants : [];
  const otherUid = participants.find((uid) => uid !== myUid) || null;
  const name = otherUid ? chat?.participantNames?.[otherUid] : null;
  const photo = otherUid ? chat?.participantPhotos?.[otherUid] : null;
  return {
    uid: otherUid,
    name: name || 'User',
    photo: photo || ''
  };
};

/**
 * Find (or create) the one-to-one conversation with another user.
 * Safe to call repeatedly: the deterministic id makes it idempotent.
 *
 * @param {string} otherUid
 * @param {string} [otherName]
 * @param {string} [otherPhoto]
 * @param {{name?: string, photo?: string}} [self] your own display name/photo,
 *   used because email/password accounts have no Firebase `displayName`.
 */
export const openDirectChat = async (otherUid, otherName, otherPhoto, self) => {
  const user = auth.currentUser;
  if (!user) throw new Error('You need to be signed in to start a chat.');
  if (!otherUid) throw new Error('No recipient was provided for this chat.');
  if (otherUid === user.uid) throw new Error('You cannot start a chat with yourself.');

  const chatId = getDirectChatId(user.uid, otherUid);
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  const myName = user.displayName || self?.name || user.email || 'User';
  const myPhoto = user.photoURL || self?.photo || '';
  const theirName = otherName || 'User';
  const theirPhoto = otherPhoto || '';

  if (!chatSnap.exists()) {
    try {
      await setDoc(chatRef, {
        participants: [user.uid, otherUid],
        participantNames: {
          [user.uid]: myName,
          [otherUid]: theirName
        },
        participantPhotos: {
          [user.uid]: myPhoto,
          [otherUid]: theirPhoto
        },
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('openDirectChat error:', error);
      // Two devices can race to create the same deterministic document.
      if (error?.code === 'already-exists') return chatId;
      throw new Error(describeFirebaseError(error, 'Could not start the conversation. Please try again.'));
    }
    return chatId;
  }

  // Conversation already exists - reuse it. Refresh the cached display details
  // only when they actually changed so an old name/photo does not stick around.
  const existing = chatSnap.data() || {};
  const names = existing.participantNames || {};
  const photos = existing.participantPhotos || {};
  const patch = {};
  if (names[user.uid] !== myName) {
    patch.participantNames = { ...names, [user.uid]: myName };
  }
  if (names[otherUid] !== theirName) {
    patch.participantNames = { ...(patch.participantNames || names), [otherUid]: theirName };
  }
  if ((photos[otherUid] || '') !== theirPhoto) {
    patch.participantPhotos = { ...(patch.participantPhotos || photos), [otherUid]: theirPhoto };
  }
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = serverTimestamp();
    await setDoc(chatRef, patch, { merge: true }).catch((e) => {
      console.warn('Could not refresh chat participant details:', e);
    });
  }

  return chatId;
};

/**
 * Append a message to a conversation and refresh its list metadata.
 * @param {string} chatId
 * @param {string} text
 * @param {{name?: string}} [self] your display name, because email/password
 *   accounts have no Firebase `displayName`
 * @returns {Promise<string>} the new message id
 */
export const sendMessage = async (chatId, text, self) => {
  const user = auth.currentUser;
  if (!user) throw new Error('You need to be signed in to send a message.');
  if (!chatId) throw new Error('No conversation was selected.');

  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`);
  }

  try {
    const ref = await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: trimmed,
      senderUid: user.uid,
      senderName: user.displayName || self?.name || user.email || 'User',
      sentAt: serverTimestamp()
    });

    // Keep the conversation list in sync (allowed by the chat update rule).
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: trimmed,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return ref.id;
  } catch (error) {
    console.error('sendMessage error:', error);
    throw new Error(describeFirebaseError(error, 'Failed to send message. Please try again.'));
  }
};

/** Live message list for one conversation, oldest first. */
export const subscribeToChatMessages = (chatId, callback, onError) => {
  if (!chatId) return () => {};
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('sentAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(messages);
    },
    (error) => {
      console.error('subscribeToChatMessages error:', error);
      onError?.(describeFirebaseError(error, 'Could not load messages.'));
    }
  );
};

const buildUserChatsQuery = (userId) =>
  query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc'),
    limit(50)
  );

const buildUserChatsQueryNoOrder = (userId) =>
  query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    limit(50)
  );

export const fetchUserChats = async (userId) => {
  if (!userId) return [];
  try {
    const snap = await getDocs(buildUserChatsQuery(userId));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'failed-precondition') {
      // Composite index still building - sort on the client instead.
      const snap = await getDocs(buildUserChatsQueryNoOrder(userId));
      const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortByTimestampDesc(chats, 'lastMessageAt');
    }
    throw error;
  }
};

/**
 * Live list of the signed-in user's conversations, most recent first.
 * The listener is created once per caller; the returned function removes it.
 */
export const subscribeToUserChats = (userId, callback, onError) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  try {
    return onSnapshot(
      buildUserChatsQuery(userId),
      (snap) => {
        const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(sortByTimestampDesc(chats, 'lastMessageAt'));
      },
      (error) => {
        if (error?.code === 'failed-precondition') {
          // Fall back to an un-ordered query so the list still works.
          return onSnapshot(
            buildUserChatsQueryNoOrder(userId),
            (snap) => {
              const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              callback(sortByTimestampDesc(chats, 'lastMessageAt'));
            },
            (fallbackError) => {
              console.error('subscribeToUserChats error:', fallbackError);
              onError?.(describeFirebaseError(fallbackError, 'Could not load your messages.'));
            }
          );
        }
        console.error('subscribeToUserChats error:', error);
        onError?.(describeFirebaseError(error, 'Could not load your messages.'));
      }
    );
  } catch (error) {
    console.error('subscribeToUserChats error:', error);
    onError?.(describeFirebaseError(error, 'Could not load your messages.'));
    return () => {};
  }
};

// ========== NOTIFICATIONS ==========

/**
 * Create a notification document in Firestore.
 * @param {string} recipientUid - The user who should receive the notification
 * @param {string} senderUid - The user who triggered the notification
 * @param {string} type - Notification type
 * @param {string} message - Human-readable message
 * @param {string} relatedId - ID of related entity
 * @param {string} relatedType - Type of related entity
 * @returns {Promise<string>} The notification document ID
 */
export const createNotification = async (recipientUid, senderUid, type, message, relatedId = null, relatedType = null) => {
  if (!recipientUid || !senderUid) {
    throw new Error('recipientUid and senderUid are required');
  }
  if (recipientUid === senderUid) {
    return null;
  }
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      recipientUid,
      senderUid,
      type,
      message,
      read: false,
      createdAt: serverTimestamp(),
      relatedId,
      relatedType
    });
    return docRef.id;
  } catch (error) {
    console.error('createNotification error:', error);
    throw error;
  }
};

/**
 * Best-effort notification. A failed notification must never fail the action
 * that triggered it - an application must still be recorded if the bell fails.
 */
const notifyQuietly = async (recipientUid, senderUid, type, message, relatedId, relatedType) => {
  try {
    await createNotification(recipientUid, senderUid, type, message, relatedId, relatedType);
  } catch (error) {
    console.warn('Could not create notification:', error?.message || error);
  }
};

/**
 * Fetch notifications for a user, most recent first.
 * @param {string} userId - The user's UID
 * @param {number} limitCount - Maximum number of notifications to fetch
 * @returns {Promise<Array>} Array of notification objects
 */
export const fetchUserNotifications = async (userId, limitCount = 50) => {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code === 'failed-precondition') {
      const q = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', userId)
      );
      const snap = await getDocs(q);
      const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortByTimestampDesc(notifications, 'createdAt').slice(0, limitCount);
    }
    console.error('fetchUserNotifications error:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time notifications for a user.
 * @param {string} userId - The user's UID
 * @param {Function} callback - Called with array of notifications
 * @param {Function} onError - Optional error handler
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserNotifications = (userId, callback, onError) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(notifications);
    }, (error) => {
      if (error?.code === 'failed-precondition') {
        const fallbackQ = query(
          collection(db, 'notifications'),
          where('recipientUid', '==', userId)
        );
        return onSnapshot(fallbackQ, (snap) => {
          const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(sortByTimestampDesc(notifications, 'createdAt'));
        }, (fallbackError) => {
          console.error('subscribeToUserNotifications fallback error:', fallbackError);
          onError?.(describeFirebaseError(fallbackError, 'Could not load notifications.'));
        });
      }
      console.error('subscribeToUserNotifications error:', error);
      onError?.(describeFirebaseError(error, 'Could not load notifications.'));
    });
  } catch (error) {
    console.error('subscribeToUserNotifications error:', error);
    onError?.(describeFirebaseError(error, 'Could not load notifications.'));
    return () => {};
  }
};

// ========== CLOUDINARY ==========
// Single source of truth for every upload lives in ./cloudinaryService so that
// post images, profile photos and resumes all use the exact same unsigned
// upload path. Re-exported here so existing imports keep working.
export {
  uploadToCloudinary,
  getCleanResumeUrl,
  isCloudinaryConfigured,
  CLOUDINARY_CONFIG
} from './cloudinaryService';

/**
 * Mark a single notification as read.
 * @param {string} notificationId - The notification document ID
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId) => {
  if (!notificationId) return;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    throw error;
  }
};

/**
 * Mark all unread notifications for a user as read.
 * @param {string} userId - The user's UID
 * @returns {Promise<number>} Number of notifications marked as read
 */
export const markAllNotificationsAsRead = async (userId) => {
  if (!userId) return 0;
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = [];
    snap.docs.forEach(d => {
      batch.push(updateDoc(doc(db, 'notifications', d.id), { read: true }));
    });
    await Promise.all(batch);
    return snap.docs.length;
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    throw error;
  }
};

/**
 * Get unread notification count for a user.
 * @param {string} userId - The user's UID
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
  if (!userId) return 0;
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    return snap.docs.length;
  } catch (error) {
    console.error('getUnreadNotificationCount error:', error);
    return 0;
  }
};

// ========== HELPERS ==========
export const formatTimeAgo = (timestamp) => {
  if (!timestamp?.toDate) return 'recently';
  const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const formatPostTime = (date) => {
  if (!date) return 'just now';
  const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
  const seconds = Math.floor((new Date() - d) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
};

export const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const getStatusBadge = (status) => {
  const map = {
    pending: { label: 'Pending', icon: 'ph-clock', class: 'status-badge pending' },
    accepted: { label: 'Accepted', icon: 'ph-check-circle', class: 'status-badge accepted' },
    rejected: { label: 'Rejected', icon: 'ph-x-circle', class: 'status-badge rejected' }
  };
  return map[status] || map.pending;
};