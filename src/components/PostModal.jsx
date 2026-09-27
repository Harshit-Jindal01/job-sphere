import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Image, PaperPlane } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { uploadToCloudinary, createPost } from '../services/firebaseService';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, same limit as before

export default function PostModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  // idle -> uploading (image going to Cloudinary) -> posting (writing to Firestore)
  const [status, setStatus] = useState('idle');
  const fileInputRef = useRef(null);
  const submittingRef = useRef(false);
  const { user, userData } = useAuth();
  const { showNotification } = useNotification();

  const isBusy = status !== 'idle';
  const hasContent = Boolean(content.trim());
  const canSubmit = (hasContent || Boolean(imageFile)) && !isBusy;

  const resetDraft = useCallback(() => {
    setContent('');
    setImageFile(null);
    setImagePreview(null);
    setStatus('idle');
    submittingRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Never carry a stale draft (or a half finished upload) into a new modal session
  useEffect(() => {
    if (isOpen) resetDraft();
  }, [isOpen, resetDraft]);

  const handleClose = () => {
    if (submittingRef.current) return; // don't interrupt an upload/post in flight
    resetDraft();
    onClose();
  };

  const handleImageChange = (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;

    // Reject bad files and clear the input so re-picking the same file fires again
    if (!file.type || !file.type.startsWith('image/')) {
      input.value = '';
      showNotification('Please choose an image file (JPG, PNG, GIF or WEBP).', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      input.value = '';
      showNotification('That image is too large. Please choose one under 10MB.', 'error');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.onerror = () => {
      setImageFile(null);
      setImagePreview(null);
      showNotification('That image could not be read. Please choose a different file.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Guard against double submits (double click, Enter key, etc.)
    if (submittingRef.current) return;

    const trimmed = content.trim();
    if (!trimmed && !imageFile) {
      showNotification('Write something or add an image before posting.', 'error');
      return;
    }
    if (!user) {
      showNotification('Please sign in to create a post.', 'error');
      return;
    }

    submittingRef.current = true;
    setStatus(imageFile ? 'uploading' : 'posting');

    try {
      let imageUrl = null;

      if (imageFile) {
        const result = await uploadToCloudinary(imageFile, 'jobsphere/posts');
        imageUrl = result?.url || null;
        if (!imageUrl) throw new Error('Image upload did not return a URL. Please try again.');
      }

      setStatus('posting');
      await createPost(trimmed, imageUrl, {
        name: userData?.name,
        photo: userData?.photo
      });

      showNotification('Post created successfully!', 'success');
      resetDraft();
      onClose();
    } catch (error) {
      console.error('Create post error:', error);
      showNotification(error?.message || 'Failed to create post. Please try again.', 'error');
      setStatus('idle');
      submittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="postModal">
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Create Post</h3>
          <button type="button" onClick={handleClose} disabled={isBusy} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label htmlFor="postContent" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>What's on your mind?</label>
            <textarea
              id="postContent"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, experiences, or insights..."
              rows={4}
              disabled={isBusy}
              style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div
            onClick={() => { if (!isBusy) fileInputRef.current?.click(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              border: `2px dashed ${imageFile ? 'var(--primary)' : '#e2e8f0'}`,
              borderRadius: '10px',
              background: imageFile ? 'rgba(45,106,79,0.05)' : '#f8fafc',
              cursor: isBusy ? 'not-allowed' : 'pointer'
            }}
          >
            <button type="button" tabIndex={-1} onClick={() => { if (!isBusy) fileInputRef.current?.click(); }} style={{ background: 'none', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image style={{ fontSize: '1.3rem', color: 'var(--primary)' }} />
            </button>
            <input
              id="postImage"
              type="file"
              ref={fileInputRef}
              accept="image/*"
              disabled={isBusy}
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
            <span style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>
              {imageFile ? 'Change image' : 'Add Image'}
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--gray)', fontSize: '0.8rem' }}>JPG, PNG, GIF, WEBP &middot; max 10MB</span>
          </div>

          {imagePreview && (
            <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%', borderRadius: '10px', overflow: 'hidden' }}>
              <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '10px', display: 'block' }} />
              <button type="button" onClick={removeImage} disabled={isBusy} aria-label="Remove image" style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ fontSize: '1rem' }} />
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-gradient" disabled={!canSubmit} style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isBusy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {status === 'uploading' ? 'Uploading image...' : 'Posting...'}
              </>
            ) : (
              <>
                <PaperPlane /> Post
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
