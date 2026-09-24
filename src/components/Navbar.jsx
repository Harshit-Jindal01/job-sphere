import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Hexagon, ArrowsLeftRight, List, X, UserCircle, SignOut } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onAuthClick }) {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSwitchRole = () => {
    const currentRole = localStorage.getItem('jobsphere_role');
    const newRole = currentRole === 'user' ? 'company' : 'user';
    localStorage.setItem('jobsphere_role', newRole);
    navigate(newRole === 'user' ? '/seeker' : '/company');
  };

  return (
    <header id="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">
          <Hexagon weight="fill" style={{ color: 'var(--primary)' }} />
          Job<span>Sphere</span>
        </Link>

        <nav className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          <a href="#jobs" onClick={() => setIsMenuOpen(false)}>Find Jobs</a>
          <a href="#my-applications" onClick={() => setIsMenuOpen(false)}>My Applications</a>
          <a href="#posts" onClick={() => setIsMenuOpen(false)}>Posts</a>
          <a href="#network" onClick={() => setIsMenuOpen(false)}>Network</a>
        </nav>

        <div className="auth-buttons" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="switch-role-btn" onClick={handleSwitchRole}>
            <ArrowsLeftRight /> Switch Role
          </button>

          {user ? (
            <div className="user-profile-dropdown" style={{ position: 'relative' }}>
              <div 
                className="nav-user-info" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <img 
                  src={userData?.photoUrl || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.fullName || user.displayName || 'User')}&background=6366f1&color=fff`} 
                  alt="Profile" 
                  className="nav-avatar"
                  style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                />
              </div>
              {isDropdownOpen && (
                <div className="dropdown-content" style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'white',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  padding: '10px',
                  minWidth: '200px',
                  zIndex: 1000,
                  marginTop: '10px'
                }}>
                  <div style={{ padding: '10px', borderBottom: '1px solid #eee', marginBottom: '5px' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{userData?.fullName || user.displayName || 'User'}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{user.email}</p>
                  </div>
                  <button onClick={handleLogout} style={{
                    width: '100%',
                    padding: '10px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: '#ef4444',
                    fontSize: '0.9rem'
                  }}>
                    <SignOut /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-outline login-btn" onClick={onAuthClick}>Sign In</button>
          )}

          <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ display: 'none' }}>
            {isMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
}
