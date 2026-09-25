import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { createJob } from '../services/firebaseService';

export default function PostJobModal({ isOpen, onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [jobData, setJobData] = useState({
    title: '',
    company: '',
    location: '',
    salary: '',
    description: ''
  });
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setJobData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showNotification('Please sign in to post jobs', 'error');
      return;
    }

    // Validate required fields
    if (!jobData.title.trim() || !jobData.company.trim() || !jobData.location.trim() || !jobData.salary.trim() || !jobData.description.trim()) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await createJob(jobData, user.uid);
      showNotification('Job posted successfully!', 'success');
      onClose();
      // Reset form
      setJobData({
        title: '',
        company: '',
        location: '',
        salary: '',
        description: ''
      });
    } catch (error) {
      console.error('Post job error:', error);
      showNotification('Failed to post job', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="postJobModal">
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Post a New Job</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>Job Title</label>
            <input
              type="text"
              name="title"
              value={jobData.title}
              onChange={handleChange}
              placeholder="e.g. Senior Product Designer"
              required
              style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>Company Name</label>
            <input
              type="text"
              name="company"
              value={jobData.company}
              onChange={handleChange}
              placeholder="Your company name"
              required
              style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>Location</label>
            <input
              type="text"
              name="location"
              value={jobData.location}
              onChange={handleChange}
              placeholder="e.g. Remote / New York, USA"
              required
              style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>Salary Range</label>
            <input
              type="text"
              name="salary"
              value={jobData.salary}
              onChange={handleChange}
              placeholder="e.g. $100k - $130k"
              required
              style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>Job Description</label>
            <textarea
              name="description"
              value={jobData.description}
              onChange={handleChange}
              placeholder="Describe the role and requirements..."
              required
              rows="4"
              style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', resize: 'vertical' }}
            />
          </div>
          
          <button
            type="submit"
            className="btn btn-gradient"
            disabled={isLoading}
            style={{ width: '100%', padding: '16px' }}
          >
            {isLoading ? (
              <>
                <span style={{ 
                  width: '18px', 
                  height: '18px', 
                  border: '2px solid rgba(255,255,255,0.3)', 
                  borderTopColor: 'white', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }} />
                Posting...
              </>
            ) : (
              <>
                <i className="ph-fill ph-plus" /> Post Job Now
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}