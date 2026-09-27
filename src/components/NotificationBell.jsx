import React, { useState, useEffect, useRef } from 'react';
import { Bell } from '@phosphor-icons/react';
import { useNotification } from '../context/NotificationContext';

/**
 * The notification data was already loaded and kept live by
 * NotificationContext, but nothing rendered it. This is that UI, shared by
 * every page so the seeker Navbar and the company header behave the same.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    handleNotificationClick,
    getBackgroundColor,
    getNotificationIcon,
    formatNotificationTime
  } = useNotification();

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const persisted = notifications.filter((n) => !n.transient);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
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

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '340px', maxWidth: '85vw',
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden'
        }}>
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
                You&apos;re all caught up.
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
  );
}
