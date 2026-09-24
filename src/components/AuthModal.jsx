import React, { useState } from 'react';
import { X, GoogleLogo, Envelope, Lock, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, loginWithGoogle, resetPassword } = useAuth();
  const { showNotification } = useNotification();

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        showNotification('Welcome back!', 'success');
      } else {
        const cred = await register(email, password);
        const role = localStorage.getItem('jobsphere_role') || 'user';
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid, email: cred.user.email, name: fullName,
          role: role, createdAt: serverTimestamp()
        });
        showNotification('Account created successfully!', 'success');
      }
      onClose();
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      const user = result.user;
      const role = localStorage.getItem('jobsphere_role') || 'user';
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid, email: user.email, name: user.displayName,
        photo: user.photoURL, role: role, updatedAt: serverTimestamp()
      }, { merge: true });
      showNotification('Signed in with Google!', 'success');
      onClose();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  return (
    <div className="modal-wrap active" id="authModal">
      <div className="modal-box" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>{isLogin ? 'Sign In' : 'Create Account'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>
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
