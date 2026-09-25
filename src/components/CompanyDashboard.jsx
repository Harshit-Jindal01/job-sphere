import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { fetchCompanyJobs, fetchCompanyApplications, deleteJob, updateApplicationStatus } from '../services/firebaseService';
import PostJobModal from './PostJobModal';

const CompanyDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [isPostJobModalOpen, setIsPostJobModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (user) {
      loadCompanyData();
    }
  }, [user]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const jobsData = await fetchCompanyJobs(user.uid);
      setJobs(jobsData);

      const applicationsData = await fetchCompanyApplications(user.uid);
      setApplications(applicationsData);
    } catch (error) {
      console.error('Error loading company data:', error);
      showNotification('Failed to load company data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(jobId);
        showNotification('Job deleted successfully', 'success');
        const jobsData = await fetchCompanyJobs(user.uid);
        setJobs(jobsData);
      } catch (error) {
        console.error('Error deleting job:', error);
        showNotification('Failed to delete job', 'error');
      }
    }
  };

  const handleUpdateApplicationStatus = async (appId, status) => {
    try {
      await updateApplicationStatus(appId, status);
      showNotification(`Application ${status} successfully`, 'success');
      const applicationsData = await fetchCompanyApplications(user.uid);
      setApplications(applicationsData);
    } catch (error) {
      console.error('Error updating application status:', error);
      showNotification('Failed to update application status', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <div style={{ width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
        <p>Loading company dashboard...</p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--dark)' }}>Company Dashboard</h1>
          <button
            className="btn btn-gradient"
            onClick={() => setIsPostJobModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="ph ph-plus" /> Post New Job
          </button>
        </div>

        <div style={{ marginBottom: '50px' }}>          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--dark)' }}>Posted Jobs</h2>
          {jobs.length > 0 ? (
            <div style={{ display: 'grid', gap: '20px' }}>              {jobs.map((job) => (
                <div key={job.id} style={{ padding: '20px', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--dark)' }}>{job.title}</h3>
                    <p style={{ color: 'var(--gray)', marginBottom: '8px' }}><i className="ph ph-map-pin" /> {job.location} • <i className="ph ph-currency-dollar" /> {job.salary}</p>
                    <p style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>Posted {job.postedAt ? new Date(job.postedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>                    <button
                      className="btn btn-outline"
                      onClick={() => handleDeleteJob(job.id)}
                      style={{ padding: '10px 16px' }}
                    >
                      <i className="ph ph-trash" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>              <i className="ph ph-briefcase" style={{ fontSize: '2.5rem', color: 'var(--gray)', marginBottom: '15px' }} />
              <p style={{ color: 'var(--gray)', marginBottom: '20px' }}>No jobs posted yet</p>
              <button
                className="btn btn-gradient"
                onClick={() => setIsPostJobModalOpen(true)}
              >
                Post Your First Job
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--dark)' }}>Job Applications</h2>
          {applications.length > 0 ? (
            <div style={{ display: 'grid', gap: '20px' }}>              {applications.map((app) => (
                <div key={app.id} style={{ padding: '20px', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0' }}>                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--dark)' }}>{app.jobTitle}</h3>
                      <p style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>Applied by {app.applicantName} on {app.appliedAt ? new Date(app.appliedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>                      {app.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-outline"
                            onClick={() => handleUpdateApplicationStatus(app.id, 'accepted')}
                            style={{ padding: '10px 16px', background: 'rgba(16,185,129,0.1)', color: '#059669', borderColor: 'rgba(16,185,129,0.2)' }}
                          >
                            <i className="ph ph-check" /> Accept
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => handleUpdateApplicationStatus(app.id, 'rejected')}
                            style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}
                          >
                            <i className="ph ph-x" /> Reject
                          </button>
                        </>
                      )}
                      {app.status === 'accepted' && (
                        <span style={{ padding: '8px 16px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>Accepted</span>
                      )}
                      {app.status === 'rejected' && (
                        <span style={{ padding: '8px 16px', borderRadius: '20px', background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>Rejected</span>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>                    <h4 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--dark)' }}>Applicant Details</h4>
                    <p style={{ marginBottom: '8px' }}><strong>Name:</strong> {app.applicantName}</p>
                    <p style={{ marginBottom: '8px' }}><strong>Email:</strong> {app.applicantEmail}</p>
                    {app.coverLetter && (
                      <div style={{ marginTop: '15px' }}>                        <h4 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--dark)' }}>Cover Letter</h4>
                        <p style={{ color: 'var(--gray)', lineHeight: '1.6' }}>{app.coverLetter}</p>
                      </div>
                    )}
                    {app.resumeUrl && (
                      <div style={{ marginTop: '15px' }}>                        <a
                          href={app.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px', color: '#059669', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
                        >
                          <i className="ph ph-file-pdf" /> View Resume <i className="ph ph-arrow-square-out" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>              <i className="ph ph-users" style={{ fontSize: '2.5rem', color: 'var(--gray)', marginBottom: '15px' }} />
              <p style={{ color: 'var(--gray)', marginBottom: '20px' }}>No applications received yet</p>
            </div>
          )}
        </div>
      </div>

      <PostJobModal
        isOpen={isPostJobModalOpen}
        onClose={() => {
          setIsPostJobModalOpen(false);
          loadCompanyData();
        }}
      />
    </div>
  );
};

export default CompanyDashboard;
