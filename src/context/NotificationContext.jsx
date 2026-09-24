import React, { createContext, useContext, useState } from 'react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const showNotification = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  const getBackgroundColor = (type) => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'info':
        return '#3b82f6';
      case 'warning':
        return '#f59e0b';
      default:
        return '#10b981';
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: '14px 20px',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.9rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: getBackgroundColor(n.type),
              animation: 'fadeInUp 0.3s ease'
            }}
          >
            {n.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
