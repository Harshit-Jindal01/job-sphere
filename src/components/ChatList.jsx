import React, { useState, useEffect, useCallback } from 'react';
import { ChatCircleDots, CaretRight } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  subscribeToUserChats,
  getOtherParticipant,
  formatTimeAgo
} from '../services/firebaseService';

/**
 * The signed-in user's conversations, newest first.
 *
 * Reads only the chats the user participates in
 * (where('participants','array-contains', myUid)), which is exactly what the
 * Firestore chat rule allows - no other user's conversations are exposed.
 */
export default function ChatList({ onOpenChat, title = 'Messages', emptyHint }) {
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const loadChats = useCallback(() => {
    if (!user?.uid) {
      setChats([]);
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    // A single live listener, created once and removed on unmount / user change.
    return subscribeToUserChats(
      user.uid,
      (list) => {
        setChats(list);
        setIsLoading(false);
      },
      (message) => {
        setIsLoading(false);
        showNotification(message, 'error');
      }
    );
  }, [user, showNotification]);

  useEffect(() => loadChats(), [loadChats]);

  if (!user) return null;

  return (
    <div className="chat-list" style={{ display: 'grid', gap: '12px' }}>
      {isLoading && chats.length === 0 ? (
        <p style={{ color: 'var(--gray)', fontSize: '0.9rem', padding: '10px 0' }}>Loading conversations...</p>
      ) : chats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--gray)' }}>
          <i className="ph ph-chat-circle-dots" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.4 }}></i>
          <p style={{ fontSize: '0.9rem' }}>{emptyHint || 'No conversations yet. Message a company or a candidate to start one.'}</p>
        </div>
      ) : (
        chats.map((chat) => {
          const other = getOtherParticipant(chat, user.uid);
          const lastText = (chat.lastMessage || '').trim();
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => onOpenChat(chat.id, other)}
              className="chat-list-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                width: '100%',
                textAlign: 'left',
                padding: '14px 16px',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {other.photo ? (
                  <img src={other.photo} alt={other.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ChatCircleDots style={{ fontSize: '1.4rem', color: 'var(--gray)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: 'var(--dark)', fontSize: '0.95rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {other.name}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastText || 'No messages yet'}
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray)', flexShrink: 0 }}>
                {chat.lastMessageAt ? formatTimeAgo(chat.lastMessageAt) : ''}
              </span>
              <CaretRight style={{ color: 'var(--gray)', flexShrink: 0 }} />
            </button>
          );
        })
      )}
    </div>
  );
}
