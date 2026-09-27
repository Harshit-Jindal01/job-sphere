import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircle, Hexagon, ArrowsLeftRight, Bell, Check, SignOut, PencilSimple, Briefcase, Users } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const NAV_LINKS = [
  { href: '#jobs', label: 'Find Jobs', icon: Briefcase },
  { href: '#applications', label: 'My Applications', icon: Check },
  { href: '#posts', label: 'Posts', icon: Users },
  { href: '#network', label: 'Network', icon: Users }
];

export default function Navbar({ onAuthClick, user, userData, role = 'user' }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    handleNotificationClick,
    getBackgroundColor,
    getNotificationIcon,
    formatNotificationTime
  } = useNotification();

  const menuRef = useRef(null);

  // Close the dropdowns on an outside click so they do not hang open.
  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  /**
   * One email address owns exactly one role, so "Switch Role" means "sign in
   * with the other account type", never "become the other role". Signing out and
   * returning to the role picker keeps the Firestore users document - the single
   * source of truth - fully in charge of what this account may do.
   */
  const handleSwitchRole = async () => {
    localStorage.removeItem('jobsphere_role');
    if (user) {
      await logout();
    }
    navigate('/');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleEditProfile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsProfileMenuOpen(false);
    // The page that owns the modal listens for this.
    window.dispatchEvent(new CustomEvent('open-edit-profile'));
  };

  const handleViewProfile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsProfileMenuOpen(false);
    window.dispatchEvent(new CustomEvent('view-own-profile'));
  };

  // "My Applications" is a section on the current page, so a plain anchor is
  // right. The previous href (#my-applications) did not match any element id,
  // which is why the button looked dead.
  const handleNavClick = (href) => {
    setIsMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate(href);
    }
  };

  // Persisted notifications (everything not marked `transient`).
  const persisted = notifications.filter((n) => !n.transient);

  return (
    <header id="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">
          <Hexagon weight="fill" style={{ color: 'var(--primary)' }} />
          Job<span>Sphere</span>
        </Link>

        <nav className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="auth-buttons" ref={menuRef}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="switch-role-btn" onClick={handleSwitchRole} title="Sign out and choose the other account type">
                <ArrowsLeftRight /> Switch Role
              </button>

              {/* Notifications: the data was already loaded and subscribed, but
                  nothing ever rendered it. */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { setIsNotificationsOpen(v => !v); setIsProfileMenuOpen(false); }}
                  aria-label={`Notifications (${unreadCount} unread)`}
                  style={{
                    position: 'relative', width: '38px', height: '38px', borderRadius: '10px',
                    border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dark)'
                  }}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px',
                      padding: '0 4px', borderRadius: '9px', background: '#ef4444', color: 'white',
                      fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '340px', maxWidth: '85vw', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: '0.95rem' }}>Notifications</strong>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllAsRead()}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                      {persisted.length === 0 ? (
                        <p style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--gray)', fontSize: '0.85rem', margin: 0 }}>
                          You're all caught up.
                        </p>
                      ) : (
                        persisted.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            style={{
                              display: 'flex', gap: '10px', width: '100%', textAlign: 'left',
                              padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                              background: n.read ? 'white' : 'rgba(99,102,241,0.05)', border: 'none'
                            }}
                          >
                            <span style={{
                              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                              background: getBackgroundColor(n.type), color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <i className={`ph ${getNotificationIcon(n.type)}`} />
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--dark)', fontWeight: n.read ? 500 : 700 }}>
                                {n.message}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--gray)', marginTop: '2px' }}>
                                {formatNotificationTime(n.createdAt)}
                              </span>
                            </span>
                            {!n.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '6px' }} />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--dark)' }}>
                  {userData?.name || user.email?.split('@')[0] || 'User'}
                </span>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Account menu"
                  onClick={() => { setIsProfileMenuOpen(v => !v); setIsNotificationsOpen(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsProfileMenuOpen(v => !v); }}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, cursor: 'pointer', overflow: 'hidden' }}
                >
                  {userData?.photo ? (
                    <img src={userData.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (userData?.name || user.email?.[0] || 'U').toUpperCase()
                  )}
                </div>
                {isProfileMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '200px', zIndex: 100, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dark)', margin: 0 }}>{userData?.name || user.email}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray)', margin: '2px 0 0' }}>
                        {role === 'company' ? 'Company account' : 'Job Seeker account'}
                      </p>
                    </div>
                    <button onClick={handleViewProfile} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.9rem', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <UserCircle style={{ color: 'var(--primary)' }} />
                      View Profile
                    </button>
                    <div style={{ borderTop: '1px solid #e2e8f0' }} />
                    <button onClick={handleEditProfile} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.9rem', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <PencilSimple style={{ color: 'var(--primary)' }} />
                      Edit Profile
                    </button>
                    <div style={{ borderTop: '1px solid #e2e8f0' }} />
                    <button onClick={handleLogout} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.9rem', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <SignOut style={{ color: 'var(--primary)' }} />
                      Logout
                    </button>
                  </div>
                )}
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
