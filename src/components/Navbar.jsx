import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hexagon, ArrowsLeftRight } from '@phosphor-icons/react';

export default function Navbar({ onAuthClick }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSwitchRole = () => {
    const currentRole = localStorage.getItem('jobsphere_role');
    const newRole = currentRole === 'user' ? 'company' : 'user';
    localStorage.setItem('jobsphere_role', newRole);
    window.location.href = newRole === 'user' ? '/seeker' : '/company';
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
          <button className="switch-role-btn" onClick={handleSwitchRole}>
            <ArrowsLeftRight /> Switch Role
          </button>
          <button className="btn btn-outline login-btn" onClick={onAuthClick}>Sign In</button>
        </div>
      </div>
    </header>
  );
}