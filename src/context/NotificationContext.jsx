import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount
} from '../services/firebaseService';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  // Subscribe to user's notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    setLoading(true);
    setError(null);

    getUnreadNotificationCount(user.uid)
      .then(count => setUnreadCount(count))
      .catch(err => {
        console.error('Failed to fetch unread count:', err);
        setUnreadCount(0);
      });

    unsubscribeRef.current = subscribeToUserNotifications(
      user.uid,
      (notifs) => {
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
        setLoading(false);
      },
      (err) => {
        console.error('Notification subscription error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user]);

  const showNotification = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type, transient: true }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('markAsRead error:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      const count = await markAllNotificationsAsRead(user.uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      return count;
    } catch (err) {
      console.error('markAllAsRead error:', err);
    }
  }, [user]);

  const removeNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'connection_request':
        return 'ph-user-plus';
      case 'connection_accepted':
        return 'ph-user-check';
      case 'connection_rejected':
        return 'ph-user-x';
      case 'new_message':
        return 'ph-chat-circle';
      case 'job_application':
        return 'ph-briefcase';
      case 'application_status':
        return 'ph-clipboard-text';
      case 'post_like':
        return 'ph-heart';
      case 'post_comment':
        return 'ph-chat-teardown';
      default:
        return 'ph-bell';
    }
  };

  const formatNotificationTime = (timestamp) => {
    if (!timestamp?.toDate) return 'recently';
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleNotificationClick = useCallback((notification) => {
    if (!notification.read && !notification.transient) {
      markAsRead(notification.id);
    }
    if (notification.onClick) {
      notification.onClick(notification);
    }
  }, [markAsRead]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        showNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        handleNotificationClick,
        getBackgroundColor,
        getNotificationIcon,
        formatNotificationTime
      }}
    >
      {children}
      {/* Transient toast notifications */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: 'none'
        }}
      >
        {notifications
          .filter((n) => n.transient)
          .map((n) => (
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
                animation: 'fadeInUp 0.3s ease',
                pointerEvents: 'auto'
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
