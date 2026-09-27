import React, { useState } from 'react';
import { GoogleLogo, Envelope, Lock, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  findConflictingRole,
  createAccountProfile
} from '../services/firebaseService';

// Human readable role names, used in every role related message.
const ROLE_LABEL = {
  user: 'a Job Seeker',
  company: 'a Company'
};

const roleLabel = (role) => ROLE_LABEL[role] || role;

// How the sign-up form reports a Firebase Auth failure.
const authErrorMessage = (error) => {
  switch (error?.code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
};

export default function AuthModal({ isOpen, onClose, expectedRole }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, logout, loginWithGoogle, resetPassword } = useAuth();
  const { showNotification } = useNotification();

  /**
   * THE single place where an account's role is decided.
   *
   * The Firestore document `users/{uid}` is authoritative; localStorage is not
   * consulted at all. Order of authority:
   *   1. the signed-in account's own `users/{uid}` document  -> its role wins
   *   2. if that document does not exist yet, any OTHER account that already
   *      uses the same email address keeps its role            -> blocked
   *   3. otherwise the account is provisioned with `expectedRole`
   *
   * @returns {Promise<{ok: boolean, role?: string, message?: string}>}
   */
  const resolveAccountRole = async (user, role, profile) => {
    if (!role) {
      // No account type requested for this screen: do not invent a role.
      return { ok: true };
    }

    // 1. The authoritative document for THIS account.
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const existingRole = snap.data().role;
        if (existingRole && existingRole !== role) {
          return {
            ok: false,
            role: existingRole,
            message: `This account is registered as ${roleLabel(existingRole)}. Please sign in from the ${existingRole === 'company' ? 'Company' : 'Job Seeker'} page.`
          };
        }
        // Same role (or a role-less legacy document): nothing to do.
        return { ok: true, role: existingRole || role };
      }
    } catch (err) {
      // Never lock an existing account out because a read failed.
      console.warn('Could not read the account role document:', err);
      return { ok: true, role };
    }

    // 2. No document for this account yet. This email may already belong to
    //    another account with the opposite role (e.g. a password account and a
    //    Google account created for the same address).
    const { verified, role: takenRole } = await findConflictingRole(user.email, role);
    if (verified && takenRole) {
      return {
        ok: false,
        role: takenRole,
        message: `This email is already registered as ${roleLabel(takenRole)}. One email address can only have one account type - please sign in as ${roleLabel(takenRole)}.`
      };
    }

    // 3. Free to take this role -> write the authoritative document.
    try {
      await createAccountProfile({ role, name: profile?.name, photo: profile?.photo });
      return { ok: true, role };
    } catch (err) {
      console.error('Could not create the account profile:', err);
      showNotification('Your account was created but we could not finish setting it up. Please try signing in again.', 'error');
      return { ok: false, role };
    }
  };

  /** Sign the user out again after a rejected role. */
  const rejectAndSignOut = async (message) => {
    try {
      await logout();
    } catch {
      // ignore - the message below is what matters
    }
    showNotification(message, 'error');
  };

  const handleAuth = async (e) => {
    e.preventDefault();

    if (!isLogin && password.length < 6) {
      showNotification('Password must be at least 6 characters', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        // ---- LOGIN --------------------------------------------------
        const cred = await login(email, password);
        const result = await resolveAccountRole(cred.user, expectedRole);
        if (!result.ok) {
          await rejectAndSignOut(result.message);
          return;
        }
        showNotification('Welcome back!', 'success');
      } else {
        // ---- REGISTER -----------------------------------------------
        // The account is created first because the role lookup is only
        // permitted once we are authenticated (Firestore security rules).
        // Firebase itself refuses a second password account for the same
        // address, so the lookup below is what catches the remaining case:
        // the address already being used by the opposite role.
        const cred = await register(email, password);
        const result = await resolveAccountRole(cred.user, expectedRole, {
          name: fullName
        });
        if (!result.ok) {
          // Do not leave a usable credential behind for a rejected sign-up.
          try {
            await cred.user.delete();
          } catch {
            // best effort - the account has no data either way
          }
          await rejectAndSignOut(result.message);
          return;
        }
        showNotification('Account created! Welcome!', 'success');
      }
      onClose();
    } catch (error) {
      showNotification(authErrorMessage(error), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const cred = await loginWithGoogle();
      const result = await resolveAccountRole(cred.user, expectedRole);
      if (!result.ok) {
        await rejectAndSignOut(result.message);
        return;
      }
      showNotification('Signed in with Google!', 'success');
      onClose();
    } catch (error) {
      // A cancelled popup is not an error worth shouting about.
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return;
      }
      showNotification(authErrorMessage(error), 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="authModal">
      <div className="modal-box" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>{isLogin ? 'Sign In' : 'Create Account'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>
        {expectedRole && (
          <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '18px', textAlign: 'center' }}>
            {isLogin
              ? `Signing in as ${roleLabel(expectedRole)}`
              : `Creating a ${roleLabel(expectedRole)} account`}
          </p>
        )}
        <div className="auth-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '25px', background: '#f1f5f9', padding: '5px', borderRadius: '12px' }}>
          <button className={`auth-toggle ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Login</button>
          <button className={`auth-toggle ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Register</button>
        </div>
        <form onSubmit={handleAuth} style={{ display: 'grid', gap: '15px' }}>
          {!isLogin && (
            <div className="input-group">
              <User size={20} className="input-icon" />
              <input type="text" placeholder="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="auth-input" />
            </div>
          )}
          <div className="input-group">
            <Envelope size={20} className="input-icon" />
            <input type="email" placeholder="Email Address" required value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" />
          </div>
          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" />
          </div>
          <button type="submit" className="btn btn-gradient" disabled={isLoading} style={{ width: '100%', padding: '14px' }}>
            {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>
        <div className="auth-divider">
          <hr /> <span>OR</span>
        </div>
        <button onClick={handleGoogleLogin} className="btn btn-outline" style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <GoogleLogo weight="bold" /> Continue with Google
        </button>
        {isLogin && (
          <p className="auth-footer">
            Forgot password? <span onClick={() => resetPassword(email)}>Reset it</span>
          </p>
        )}
      </div>
    </div>
  );
}
