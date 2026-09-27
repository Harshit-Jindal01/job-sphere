import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { syncUserDirectoryEntry } from '../services/firebaseService';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }
      setUser(user);
      if (user) {
        // Listen to user document in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        let directorySyncedFor = null;
        // NOTE: the snapshot parameter is deliberately NOT named `doc` - that
        // would shadow the imported doc() helper used below.
        unsubscribeUserDoc = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData(data);
            // Mirror the authoritative role into the UI hint so the navbar /
            // "Switch Role" routing stays truthful. This is only a hint:
            // no permission decision is ever made from localStorage, the
            // Firestore `users/{uid}` document is the single source of truth.
            if (data?.role) {
              localStorage.setItem('jobsphere_role', data.role);
            }
            // Keep this member's public directory entry up to date so they can
            // be found by "Connect". Runs once per sign-in, never blocks it.
            if (directorySyncedFor !== user.uid) {
              directorySyncedFor = user.uid;
              getDoc(doc(db, 'userProfiles', user.uid))
                .then(profileSnap => syncUserDirectoryEntry(data, profileSnap.exists() ? profileSnap.data() : null))
                .catch(() => {});
            }
          } else {
            setUserData(null);
            localStorage.removeItem('jobsphere_role');
          }
          setLoading(false);
        }, (error) => {
          console.error('[AuthProvider] User document snapshot error:', error);
          setLoading(false);
        });
      } else {
        setUserData(null);
        localStorage.removeItem('jobsphere_role');
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeAuth();
    };
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const loginWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const value = {
    user,
    userData,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

