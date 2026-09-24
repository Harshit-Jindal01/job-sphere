import React, { useState, useEffect, useRef } from 'react';
import { X, PaperPlaneTilt, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { subscribeToChatMessages, sendMessage, formatTimeAgo } from '../services/firebaseService';

export default function ChatModal({ isOpen, onClose, chatId, otherUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (!isOpen || !chatId) return;

    const unsubscribe = subscribeToChatMessages(chatId, (msgs) => {
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [isOpen, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await sendMessage(chatId, text);
    } catch (e) {
      console.error('Send message error:', e);
      showNotification('Failed to send message', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '24px' }}>
      <div className="chat-box" style={{ width: '380px', height: '520px', background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="chat-header" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', color: 'white' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {otherUser?.photo ? (
              <img src={otherUser.photo} alt={otherUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <User style={{ fontSize: '1.5rem', color: 'var(--gray)' }} />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '2px' }}>{otherUser?.name || 'Unknown'}</h4>
            <small style={{ opacity: 0.8, fontSize: '0.75rem' }}>Online</small>
          </div>
          <button onClick={onClose} className="close-chat" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.4rem' }}>
            <X />
          </button>
        </div>
        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '20px 0' }}>
              <User style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.4 }} />
              Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`chat-msg ${msg.senderUid === user?.uid ? 'sent' : 'received'}`} style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: '16px', fontSize: '0.9rem', lineHeight: '1.4', wordBreak: 'break-word', ...(msg.senderUid === user?.uid ? {
                alignSelf: 'flex-end',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                borderBottomRightRadius: '4px'
              } : {
                alignSelf: 'flex-start',
                background: 'white',
                color: '#1e293b',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderBottomLeftRadius: '4px'
              })}}>
                <div className="msg-sender" style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '2px', opacity: 0.7, textAlign: msg.senderUid === user?.uid ? 'right' : 'left' }}>
                  {msg.senderUid === user?.uid ? 'You' : (msg.senderName || 'Them')}
                </div>
                <div>{msg.text}</div>
                <div className="msg-time" style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                  {msg.sentAt ? formatTimeAgo(msg.sentAt) : 'just now'}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="chat-input-row" style={{ padding: '12px 16px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '20px', fontSize: '0.9rem', outline: 'none' }} />
          <button type="submit" className="chat-send-btn" disabled={!newMessage.trim() || isLoading} style={{ padding: '10px 14px', background: 'var(--primary)', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PaperPlaneTilt />
          </button>
        </form>
      </div>
    </div>
  );
}
