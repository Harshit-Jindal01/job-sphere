import React, { useEffect, useState } from "react";
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { fetchJobById } from '../services/firebaseService';
import { normalizeJob, getApplicationStatusMeta } from '../utils/jobFilters';
import ApplyModal from './ApplyModal';

const sectionStyle = { marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' };
const headingStyle = { fontSize: '1.1rem', marginBottom: '12px', color: 'var(--dark)' };

const MetaRow = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <i className={`ph ${icon}`} style={{ fontSize: '1rem' }} />
      {label ? <strong style={{ color: 'var(--dark)' }}>{label}: </strong> : null}
      {value}
    </span>
  );
};

export default function JobDetailsModal({
  isOpen,
  onClose,
  job: initialJob,
  application = null,
  onApplicationChange
}) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [job, setJob] = useState(initialJob);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  // Reload the job document each time the modal opens so the card data (which
  // may be a snapshot) is never stale.
  useEffect(() => {
    if (isOpen && initialJob) {
      loadJobDetails();
    } else {
      setJob(initialJob);
      setError(null);
    }
  }, [isOpen, initialJob]);

  const loadJobDetails = async () => {
    if (!initialJob || !initialJob.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const jobData = await fetchJobById(initialJob.id);
      if (jobData) setJob(jobData);
      else setError('Job not found');
    } catch (err) {
      console.error('Error loading job details:', err);
      setError('Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!user) {
      showNotification('Please sign in to apply', 'error');
      return;
    }
    if (application) {
      showNotification(`You already applied to this job (${getApplicationStatusMeta(application.status).label}).`, 'info');
      return;
    }
    setIsApplyModalOpen(true);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (!isOpen) return null;

  const view = normalizeJob(job);
  const statusMeta = application ? getApplicationStatusMeta(application.status) : null;

  return (
    <div className="modal-wrap active" id="jobDetailsModal">
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Job Details</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', margin: '0 auto 15px' }} />
            <p style={{ color: 'var(--gray)' }}>Loading job details...</p>
          </div>
        )}

        {error && !isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#dc2626' }}>
            <i className="ph ph-warning-circle" style={{ fontSize: '3rem', marginBottom: '15px', display: 'block' }}></i>
            <p>{error}</p>
            <button type="button" onClick={loadJobDetails} className="btn btn-outline" style={{ marginTop: '15px' }}>Retry</button>
          </div>
        )}

        {job && !isLoading && !error && (
          <div>
            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.8rem', flexShrink: 0 }}>
                  <i className="ph ph-buildings" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--dark)' }}>{view.title}</h2>
                  <p style={{ fontSize: '1.1rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '12px' }}>{view.company}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.9rem', color: 'var(--gray)' }}>
                    <MetaRow icon="ph-map-pin" value={view.location} />
                    <MetaRow icon="ph-briefcase" value={view.category} />
                    <MetaRow icon="ph-clock" value={view.workType} />
                    <MetaRow icon="ph-wifi" value={view.workMode} />
                    <MetaRow icon="ph-chart-bar" value={view.experienceLevel} />
                    {view.salary && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 600 }}>
                        <i className="ph ph-currency-circle-dollar" style={{ fontSize: '1rem' }} />
                        {view.salary}
                      </span>
                    )}
                    <MetaRow icon="ph-calendar" value={formatDate(view.postedAt) ? `Posted ${formatDate(view.postedAt)}` : null} />
                  </div>
                </div>
              </div>
            </div>

            {view.skills.length > 0 && (
              <div style={sectionStyle}>
                <h4 style={headingStyle}>
                  <i className="ph ph-lightning" style={{ color: 'var(--primary)', marginRight: '8px' }} />
                  Required Skills
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {view.skills.map(skill => (
                    <span key={skill} style={{ padding: '6px 14px', background: 'var(--light-gray)', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--dark)', fontWeight: 600 }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {view.description && (
              <div style={sectionStyle}>
                <h4 style={headingStyle}>
                  <i className="ph ph-file-text" style={{ color: 'var(--primary)', marginRight: '8px' }} />
                  Job Description
                </h4>
                <div style={{ lineHeight: '1.7', color: 'var(--dark)', whiteSpace: 'pre-wrap' }}>
                  {view.description}
                </div>
              </div>
            )}

            {view.requirements && (
              <div style={sectionStyle}>
                <h4 style={headingStyle}>
                  <i className="ph ph-list-checks" style={{ color: 'var(--primary)', marginRight: '8px' }} />
                  Requirements
                </h4>
                <div style={{ lineHeight: '1.7', color: 'var(--dark)', whiteSpace: 'pre-wrap' }}>
                  {view.requirements}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px' }}>
              {application && statusMeta && (
                <div style={{ textAlign: 'center' }}>
                  <span className={`status-badge ${statusMeta.className}`} style={{ fontSize: '0.9rem' }}>
                    <i className="ph-fill ph-check-circle" style={{ marginRight: '6px' }} />
                    Application Status: {statusMeta.label}
                  </span>
                </div>
              )}
              {application ? (
                <button
                  type="button"
                  className="btn"
                  onClick={handleApply}
                  disabled
                  style={{ width: '100%', padding: '16px', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  <i className="ph ph-check-circle" style={{ marginRight: '8px' }} />
                  {statusMeta ? `Already Applied - ${statusMeta.label}` : 'Already Applied'}
                </button>
              ) : (
                <button type="button" className="btn btn-gradient" onClick={handleApply} style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <i className="ph ph-paper-plane" /> Apply Now
                </button>
              )}
            </div>
          </div>
        )}

        <ApplyModal
          isOpen={isApplyModalOpen}
          onClose={async () => {
            setIsApplyModalOpen(false);
            // Refresh applications so the card status updates immediately.
            await onApplicationChange?.();
          }}
          job={job}
        />
      </div>
    </div>
  );
}
