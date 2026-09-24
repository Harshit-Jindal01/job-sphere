import React, { useState, useRef } from 'react';
import { X, Image, Upload, PaperPlane } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { uploadToCloudinary, createPost } from '../services/firebaseService';

export default function PostModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.match('image.*')) {
        showNotification('Please upload an image file', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showNotification('Image size must be less than 10MB', 'error');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;
    if (!user) { showNotification('Please sign in to post', 'error'); return; }

    setIsLoading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const result = await uploadToCloudinary(imageFile, 'jobsphere/posts');
        imageUrl = result.url;
      }

      await createPost(content, imageUrl);
      showNotification('Post created successfully!', 'success');
      onClose();
      setContent('');
      setImageFile(null);
      setImagePreview(null);
    } catch (e) {
      console.error('Create post error:', e);
      showNotification('Failed to create post', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="postModal">
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Create Post</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>What's on your mind?</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, experiences, or insights..."
              rows={4}
              style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image style={{ fontSize: '1.3rem', color: 'var(--primary)' }} />
            </button>
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            <span style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>Add Image</span>
          </div>

          {imagePreview && (
            <div style={{ position: 'relative', display: 'inline-block', borderRadius: '10px', overflow: 'hidden' }}>
              <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '10px', display: 'block' }} />
              <button type="button" onClick={removeImage} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ fontSize: '1rem' }} />
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-gradient" disabled={isLoading || (!content.trim() && !imageFile)} style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isLoading ? (
              <>
                <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Posting...
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
