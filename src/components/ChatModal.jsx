import React, { useState, useEffect, useRef } from 'react';
import { X, PaperPlaneTilt, User, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { subscribeToChatMessages, sendMessage, formatTimeAgo, MAX_MESSAGE_LENGTH } from '../services/firebaseService';

export default function ChatModal({ isOpen, onClose, chatId, otherUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);
  const { user, userData } = useAuth();
  const { showNotification } = useNotification();

  // Email/password accounts have no Firebase displayName, so fall back to the
  // profile name from the authoritative users/{uid} document.
  const selfName = userData?.name || user?.displayName || user?.email || 'User';
  const isMine = (msg) => msg.senderUid === user?.uid;

  // One listener per open chat, always torn down again. Re-running for the same
  // chatId is safe: React unsubscribes the previous effect before subscribing.
  useEffect(() => {
    if (!isOpen || !chatId) return undefined;

    setMessages([]);
    setHasMore(true);
    setNewMessage('');
    sendingRef.current = false;
    setIsSending(false);

    const unsubscribe = subscribeToChatMessages(
      chatId,
      (msgs) => {
        setMessages(msgs);
        setHasMore(true);
      },
      (message) => showNotification(message, 'error')
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, chatId, showNotification]);

  // New chat / reopened chat -> start from a clean draft.
  useEffect(() => {
    if (isOpen) setNewMessage('');
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (sendingRef.current) return; // block double submits

    const text = newMessage.trim();
    if (!text) return;
    if (!chatId) {
      showNotification('No conversation was selected.', 'error');
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      showNotification(`Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`, 'error');
      return;
    }

    sendingRef.current = true;
    setIsSending(true);
    // Keep the text in the box until the send actually succeeds.
    setNewMessage('');

    try {
      await sendMessage(chatId, text, { name: selfName });
      setHasMore(true);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Send message error:', err);
      setNewMessage(text); // give the user their text back
      showNotification(err?.message || 'Failed to send message', 'error');
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="chatModal">
      <div className="chat-box" style={{ width: '380px', maxWidth: '100%', height: '520px', background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="chat-header" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', color: 'white' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {otherUser?.photo ? (
              <img src={otherUser.photo} alt={otherUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <User style={{ fontSize: '1.5rem', color: 'var(--gray)' }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherUser?.name || 'User'}</h4>
            <small style={{ opacity: 0.8, fontSize: '0.75rem' }}>Direct message</small>
          </div>
          <button type="button" onClick={onClose} className="close-chat" aria-label="Close chat" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.4rem', display: 'flex' }}>
            <X />
          </button>
        </div>

        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}>
          {!hasMore ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '20px 0' }}>
              <User style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.4 }} />
              Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={msg.id || index} className={`chat-msg ${isMine(msg) ? 'sent' : 'received'}`} style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: '16px', fontSize: '0.9rem', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap', ...(isMine(msg) ? {
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
                <div className="msg-sender" style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '2px', opacity: 0.7, textAlign: isMine(msg) ? 'right' : 'left' }}>
                  {isMine(msg) ? 'You' : (msg.senderName || 'Them')}
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
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Type a message..."
            aria-label="Message"
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '20px', fontSize: '0.9rem', outline: 'none' }}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!newMessage.trim() || isSending}
            aria-label="Send message"
            style={{ padding: '10px 14px', background: 'var(--primary)', border: 'none', borderRadius: '50%', color: 'white', cursor: isSending ? 'default' : 'pointer', opacity: (!newMessage.trim() || isSending) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSending ? <SpinnerGap style={{ animation: 'spin 1s linear infinite' }} /> : <PaperPlaneTilt />}
          </button>
        </form>
      </div>
    </div>
  );
}
