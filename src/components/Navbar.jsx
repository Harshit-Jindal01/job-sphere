import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon, ArrowsLeftRight, UserCircle, Buildings } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onAuthClick, user, userData }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleSwitchRole = () => {
    const currentRole = localStorage.getItem('jobsphere_role');
    const newRole = currentRole === 'user' ? 'company' : 'user';
    localStorage.setItem('jobsphere_role', newRole);
    if (newRole === 'user') {
      navigate('/seeker');
    } else {
      navigate('/company');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
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

        <div className="auth-buttons">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="switch-role-btn" onClick={handleSwitchRole}>
                <ArrowsLeftRight /> Switch Role
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--dark)' }}>
                  {userData?.name || user.email?.split('@')[0] || 'User'}
                </span>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                  {(userData?.name || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 16px' }}>
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="switch-role-btn" onClick={handleSwitchRole}>
                <ArrowsLeftRight /> Switch Role
              </button>
              <button className="btn btn-outline login-btn" onClick={onAuthClick}>Sign In</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}