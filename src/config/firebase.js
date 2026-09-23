import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDd__6OHlg3eAkY0FBLs4ITLV-UlqZlhXg",
  authDomain: "job-sphere-d1f67.firebaseapp.com",
  projectId: "job-sphere-d1f67",
  storageBucket: "job-sphere-d1f67.firebasestorage.app",
  messagingSenderId: "438846062004",
  appId: "1:438846062004:web:23776515aeea24477206e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
