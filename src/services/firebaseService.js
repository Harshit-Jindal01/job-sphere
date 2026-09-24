import {
  collection, addDoc, getDocs, getDoc, setDoc, doc, query, where,
  orderBy, serverTimestamp, updateDoc, deleteDoc, onSnapshot,
  limit, startAfter
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';

// ========== JOBS ==========
export const fetchJobs = async () => {
  const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchJobById = async (jobId) => {
  const snap = await getDoc(doc(db, 'jobs', jobId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createJob = async (jobData, userId) => {
  const data = {
    ...jobData,
    postedBy: userId,
    postedByName: auth.currentUser?.displayName || '',
    postedByPhoto: auth.currentUser?.photoURL || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'jobs'), data);
  return ref.id;
};

export const updateJob = async (jobId, data) => {
  await updateDoc(doc(db, 'jobs', jobId), {
    ...data,
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
  return ref.id;
};

export const fetchUserApplications = async (userId) => {
  const q = query(
    collection(db, 'applications'),
    where('applicantUid', '==', userId),
    orderBy('appliedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchCompanyApplications = async (companyUid) => {
  const q = query(
    collection(db, 'applications'),
    where('companyUid', '==', companyUid),
    orderBy('appliedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateApplicationStatus = async (applicationId, status) => {
  await updateDoc(doc(db, 'applications', applicationId), {
    status,
    updatedAt: serverTimestamp()
  });
};

export const subscribeToApplications = (userId, callback) => {
  const q = query(
    collection(db, 'applications'),
    where('applicantUid', '==', userId),
    orderBy('appliedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(apps);
  });
};

export const subscribeToCompanyApplications = (companyUid, callback) => {
  const q = query(
    collection(db, 'applications'),
    where('companyUid', '==', companyUid),
    orderBy('appliedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(apps);
  });
};

// ========== USERS & PROFILES ==========
export const fetchUserProfile = async (uid) => {
  const [userSnap, profSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'userProfiles', uid))
  ]);

  if (!userSnap.exists()) return null;

  return {
    uid,
    ...userSnap.data(),
    profile: profSnap.exists() ? profSnap.data() : {}
  };
};

export const updateUserProfile = async (uid, profileData) => {
  const data = {
    ...profileData,
    uid,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'userProfiles', uid), data, { merge: true });

  if (profileData.fullName || profileData.photoUrl) {
    await setDoc(doc(db, 'users', uid), {
      name: profileData.fullName,
      photo: profileData.photoUrl
    }, { merge: true });
  }
};

export const fetchCurrentUserProfile = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return fetchUserProfile(user.uid);
};

// ========== POSTS ==========
export const createPost = async (content, imageUrl = null) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const postData = {
    authorId: user.uid,
    authorName: user.displayName || user.email,
    authorPhoto: user.photoURL || '',
    content,
    imageUrl,
    likes: [],
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'posts'), postData);
  return ref.id;
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

export const subscribeToPosts = (callback) => {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.deleted);
    callback(posts);
  });
}

// ========== CONNECTIONS ==========
export const searchUsers = async (searchTerm, currentUid) => {
  if (!searchTerm.trim()) return [];

  const q = query(
    collection(db, 'users'),
    where('name', '>=', searchTerm),
    where('name', '<=', searchTerm + '\uf8ff'),
    limit(10)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.uid !== currentUid);
};

export const sendConnectionRequest = async (toUid, toName, toPhoto) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

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

  const connectionData = {
    from: user.uid,
    fromName: user.displayName || user.email,
    fromPhoto: user.photoURL || '',
    to: toUid,
    toName,
    toPhoto,
    status: 'pending',
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'connections'), connectionData);
  return ref.id;
};

export const acceptConnection = async (connectionId) => {
  await updateDoc(doc(db, 'connections', connectionId), {
    status: 'accepted',
    updatedAt: serverTimestamp()
  });
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

export const fetchUserConnections = async (uid) => {
  return fetchConnections(uid);
};

export const subscribeToReceivedRequests = (uid, callback) => {
  const q = query(
    collection(db, 'connections'),
    where('to', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(requests);
  });
};

export const subscribeToSentRequests = (uid, callback) => {
  const q = query(
    collection(db, 'connections'),
    where('from', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(requests);
  });
};

// ========== CHATS ==========
export const getDirectChatId = (uid1, uid2) => {
  return uid1 < uid2 ? `dm_${uid1}_${uid2}` : `dm_${uid2}_${uid1}`;
};

export const openDirectChat = async (otherUid, otherName, otherPhoto) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const chatId = getDirectChatId(user.uid, otherUid);
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      participants: [user.uid, otherUid],
      participantNames: {
        [user.uid]: user.displayName || user.email,
        [otherUid]: otherName
      },
      participantPhotos: {
        [user.uid]: user.photoURL || '',
        [otherUid]: otherPhoto
      },
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return chatId;
};

export const sendMessage = async (chatId, text) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text,
    senderUid: user.uid,
    senderName: user.displayName || user.email,
    sentAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const subscribeToChatMessages = (chatId, callback) => {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('sentAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
};

export const fetchUserChats = async (userId) => {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const subscribeToUserChats = (userId, callback) => {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  });
};

// ========== CLOUDINARY ==========
export const uploadToCloudinary = async (file, folder = 'jobsphere') => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dsv4npqz3';
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'jobsphere_media';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return {
    url: data.secure_url,
    publicId: data.public_id,
    format: data.format,
    resourceType: data.resource_type
  };
};

export const getCleanResumeUrl = (url) => {
  if (!url) return null;
  return url.replace('/fl_attachment/', '/');
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