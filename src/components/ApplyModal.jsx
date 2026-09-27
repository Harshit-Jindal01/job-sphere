import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, PaperPlane } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { uploadToCloudinary, getCleanResumeUrl, fetchCurrentUserProfile, applyToJob } from '../services/firebaseService';

export default function ApplyModal({ isOpen, onClose, job }) {
  const [isLoading, setIsLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumePreview, setResumePreview] = useState(null);
  const [useExistingResume, setUseExistingResume] = useState(false);
  const [existingResumeUrl, setExistingResumeUrl] = useState('');
  const [existingResumeName, setExistingResumeName] = useState('');
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen) { loadExistingResume(); setCoverLetter(''); setResumeFile(null); setResumePreview(null); setUseExistingResume(false); }
  }, [isOpen]);

  const loadExistingResume = async () => {
    if (!user) return;
    try {
      const profile = await fetchCurrentUserProfile();
      if (profile?.profile?.resumeUrl) {
        setExistingResumeUrl(getCleanResumeUrl(profile.profile.resumeUrl));
        setExistingResumeName(profile.profile.resumeFileName || 'resume.pdf');
        setUseExistingResume(true);
      }
    } catch (e) { console.error('Failed to load existing resume:', e); }
  };

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.match(/\.(pdf|doc|docx)$/i)) { showNotification('Please upload a PDF, DOC, or DOCX file', 'error'); return; }
      if (file.size > 5 * 1024 * 1024) { showNotification('File size must be less than 5MB', 'error'); return; }
      setResumeFile(file); setResumePreview(file.name); setUseExistingResume(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { showNotification('Please sign in to apply', 'error'); return; }
    setIsLoading(true);
    try {
      let resumeUrl = useExistingResume ? existingResumeUrl : null;
      let resumeFileName = useExistingResume ? existingResumeName : null;
      if (resumeFile) { const result = await uploadToCloudinary(resumeFile, 'jobsphere/resumes'); resumeUrl = result.url; resumeFileName = resumeFile.name; }
      if (!resumeUrl) { showNotification('Please provide a resume', 'error'); setIsLoading(false); return; }
      await applyToJob(job.id, job.title, job.company, coverLetter, resumeUrl, resumeFileName);
      showNotification('Application submitted successfully!', 'success');
      onClose();
    } catch (error) { console.error('Apply error:', error); showNotification(error.message || 'Failed to submit application', 'error'); }
    finally { setIsLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="applyModal">
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Apply for {job?.title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>
        <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
          <p style={{ fontWeight: 600, color: 'var(--dark)', marginBottom: '4px' }}>{job?.company}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray)' }}>{job?.location} • {job?.type}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600, marginTop: '8px' }}>{job?.salary}</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>
              Cover Letter <span style={{ color: 'var(--primary)', fontWeight: 400, fontSize: '0.85rem' }}>(Optional)</span>
            </label>
            <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Tell the employer why you're a great fit for this role..." rows={4} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)' }}>Resume / CV <span style={{ color: 'var(--primary)', fontWeight: 400, fontSize: '0.85rem' }}>(Required)</span></label>
            {useExistingResume && existingResumeUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '12px' }}>
                <FileText style={{ fontSize: '1.5rem', color: '#059669' }} />
                <div style={{ flex: 1 }}><p style={{ fontWeight: 600, color: '#059669', fontSize: '0.9rem' }}>Current Resume</p><p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '2px' }}>{existingResumeName}</p></div>
                <label style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}><input type="radio" name="resumeOption" checked={useExistingResume} onChange={() => setUseExistingResume(true)} style={{ marginRight: '6px' }} /> Use this</label>
              </div>
            )}
            <div
              onClick={() => {
                setUseExistingResume(false);
                fileInputRef.current?.click();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                border: `2px dashed ${useExistingResume ? '#e2e8f0' : 'var(--primary)'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                background: useExistingResume ? 'white' : 'rgba(99,102,241,0.05)'
              }}
            >
              <Upload style={{ fontSize: '1.5rem', color: 'var(--primary)' }} />
              <div style={{ flex: 1 }}>
                <p style={{
                  fontWeight: 600,
                  color: useExistingResume ? 'var(--gray)' : 'var(--dark)',
                  fontSize: '0.9rem'
                }}>
                  {resumePreview ? `Selected: ${resumePreview}` : 'Upload New Resume (PDF, DOC, DOCX)'}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray)', marginTop: '2px' }}>
                  Max 5MB
                </p>
              </div>

              <input
                type="radio"
                name="resumeOption"
                checked={!useExistingResume}
                onChange={() => setUseExistingResume(false)}
                onClick={(e) => e.stopPropagation()}
                style={{ marginRight: '6px' }}
              />

              <input
                ref={fileInputRef}
                type="file"
                id="applyResumeInput"
                accept=".pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleResumeChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-gradient" disabled={isLoading} style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isLoading ? (
              <>
                <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Submitting...
              </>
            ) : (
              <>
                <PaperPlane /> Submit Application
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
