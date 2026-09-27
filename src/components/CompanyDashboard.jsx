import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  fetchCompanyJobs, fetchCompanyApplications, deleteJob, updateApplicationStatus,
  openDirectChat, subscribeToPosts, subscribeToCompanyApplications,
  subscribeToCompanyJobs, fetchPostComments, likePost, addComment, formatPostTime,
  subscribeToReceivedRequests, acceptConnection, rejectConnection
} from '../services/firebaseService';
import { normalizeJob } from '../utils/jobFilters';
import PostJobModal from './PostJobModal';
import AuthModal from './AuthModal';
import ChatList from './ChatList';
import ChatModal from './ChatModal';
import PostModal from './PostModal';
import PostCard from './PostCard';
import NotificationBell from './NotificationBell';
import ViewProfileModal from './ViewProfileModal';
import EditProfileModal from './EditProfileModal';

const CompanyDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [isPostJobModalOpen, setIsPostJobModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null); // { chatId, otherUser }
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  // Job editing
  const [editingJob, setEditingJob] = useState(null);
  // Live incoming connection requests (companies must be able to act on them)
  const [incomingRequests, setIncomingRequests] = useState([]);
  // Profile modals. The company dashboard has no Navbar, so it owns these
  // directly instead of listening for window events.
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  // A non-null uid means the profile modal is open (one state, not two that
  // can drift apart).
  const [viewProfileUserId, setViewProfileUserId] = useState(null);
  // Community posts (read-only for companies, plus their own posts)
  const [posts, setPosts] = useState([]);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  // Post interactions
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [isLiking, setIsLiking] = useState({});
  const [isCommenting, setIsCommenting] = useState({});
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const { user, userData, logout } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  // The Firestore `users/{uid}` document is the authoritative role source.
  // localStorage is only a routing hint and is never used for access control.
  const userRole = userData?.role || null;
  // Only block when the role is actually known to be different - an account
  // whose document has not loaded yet keeps the previous behaviour.
  const wrongRole = Boolean(user && userRole && userRole !== 'company');

  const handleLogout = async () => {
    await logout();
    localStorage.removeItem('jobsphere_role');
    navigate('/');
  };

  /**
   * "Switch Role" in this app means "use the other account type", never
   * "become the other role". One email address owns exactly one role
   * (enforced in AuthModal and the Firestore users document), so switching
   * signs the current company out and returns to the role picker where the
   * user can sign in with the account that holds the other role.
   * Nothing here can turn a company account into a seeker account.
   */
  const handleSwitchRole = async () => {
    await logout();
    localStorage.removeItem('jobsphere_role');
    showNotification('Signed out so you can switch account type. Use the account with the other role to sign in.', 'info');
    navigate('/');
  };

  useEffect(() => {
    if (user === null) {
      setIsAuthModalOpen(true);
      setLoading(false);
      setJobs([]);
      setApplications([]);
    } else if (wrongRole) {
      // The authoritative `users/{uid}` document says this account is a Job
      // Seeker, so it must not get a company dashboard (or any company data).
      setLoading(false);
      setJobs([]);
      setApplications([]);
      showNotification('This account is registered as a Job Seeker. Please use the Job Seeker page.', 'error');
      navigate('/');
    } else if (user) {
      loadCompanyData();
    }

    if (!user) return undefined;

    // Live listeners. A one-shot fetch would leave the company looking at an
    // empty applications list until a manual refresh, which is what made new
    // applicants invisible.
    const unsubscribers = [
      // Applications (new applicants appear, and status changes reflect back)
      subscribeToCompanyApplications(
        user.uid,
        (list) => { setApplications(list); setLoading(false); },
        (message) => showNotification(message, 'error')
      ),
      // Posted jobs (a new or edited job appears without a refresh)
      subscribeToCompanyJobs(user.uid, (list) => { setJobs(list); setLoading(false); }),
      // Community posts, same read path the seeker page uses. A company can
      // READ the feed and manage only its own posts.
      subscribeToPosts(
        (list) => setPosts(list),
        () => {}
      ),
      // Incoming connection requests
      subscribeToReceivedRequests(
        user.uid,
        setIncomingRequests,
        (message) => showNotification(message, 'error')
      )
    ];

    return () => {
      unsubscribers.forEach((fn) => {
        try { fn?.(); } catch (error) { console.error('Listener cleanup error:', error); }
      });
    };
  }, [user, userRole]);

  const handleLikePost = async (postId) => {
    if (isLiking[postId]) return;
    setIsLiking(prev => ({ ...prev, [postId]: true }));
    try {
      await likePost(postId);
    } catch (error) {
      console.error('Error liking post:', error);
      showNotification('Failed to like post', 'error');
    } finally {
      setIsLiking(prev => ({ ...prev, [postId]: false }));
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => {
      const next = { ...prev, [postId]: !prev[postId] };
      if (next[postId] && !comments[postId]) loadComments(postId);
      return next;
    });
  };

  const loadComments = async (postId) => {
    setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
    try {
      const loaded = await fetchPostComments(postId);
      setComments(prev => ({ ...prev, [postId]: loaded }));
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentTexts[postId]?.trim();
    if (!text || isCommenting[postId]) return;
    setIsCommenting(prev => ({ ...prev, [postId]: true }));
    try {
      await addComment(postId, text);
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      const fresh = await fetchPostComments(postId);
      setComments(prev => ({ ...prev, [postId]: fresh }));
    } catch (error) {
      console.error('Error adding comment:', error);
      showNotification('Failed to add comment', 'error');
    } finally {
      setIsCommenting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const loadCompanyData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const jobsData = await fetchCompanyJobs(user.uid);
      setJobs(jobsData);

      const applicationsData = await fetchCompanyApplications(user.uid);
      setApplications(applicationsData);
    } catch (error) {
      console.error('[CompanyDashboard] Error loading company data:', error);
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
        if (user) {
          const jobsData = await fetchCompanyJobs(user.uid);
          setJobs(jobsData);
        }
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
      if (user) {
        const applicationsData = await fetchCompanyApplications(user.uid);
        setApplications(applicationsData);
      }
    } catch (error) {
      console.error('Error updating application status:', error);
      showNotification('Failed to update application status', 'error');
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      showNotification('That section is not available yet.', 'info');
    }
  };

  const openViewProfile = (uid) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setViewProfileUserId(uid || user.uid);
  };

  const handleAcceptConnection = async (connectionId) => {
    try {
      await acceptConnection(connectionId);
      // The live request listener drops it from the list on its own.
      showNotification('Connection accepted!', 'success');
    } catch (error) {
      console.error('Error accepting connection:', error);
      showNotification(error?.message || 'Failed to accept connection', 'error');
    }
  };

  const handleRejectConnection = async (connectionId) => {
    try {
      await rejectConnection(connectionId);
      showNotification('Connection request declined', 'info');
    } catch (error) {
      console.error('Error declining connection:', error);
      showNotification(error?.message || 'Failed to decline connection', 'error');
    }
  };

  // ── MESSAGING ────────────────────────────────────────────────────────────
  // Opens (or reuses) the one-to-one conversation with an applicant. The chat id
  // is derived from both uids so a pair can never get two conversations.
  const startChat = async (otherUid, otherName, otherPhoto) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!otherUid) {
      showNotification('No recipient was found for this conversation.', 'error');
      return;
    }
    setIsOpeningChat(true);
    try {
      const chatId = await openDirectChat(otherUid, otherName, otherPhoto, {
        name: userData?.name,
        photo: userData?.photo
      });
      setActiveChat({ chatId, otherUser: { uid: otherUid, name: otherName || 'User', photo: otherPhoto || '' } });
    } catch (error) {
      console.error('Failed to open chat:', error);
      showNotification(error?.message || 'Failed to open chat', 'error');
    } finally {
      setIsOpeningChat(false);
    }
  };

  // Message the applicant who applied for a job.
  const messageApplicant = (app) =>
    startChat(app.applicantUid, app.applicantName || 'Applicant', app.applicantPhoto || '');

  // Open an existing conversation from the message list.
  const openExistingChat = (chatId, otherUser) => setActiveChat({ chatId, otherUser });

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--dark)' }}>Company Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {user ? (
              <>
                {/* Section shortcuts. The company dashboard has no Navbar, so
                    the equivalent actions live here. */}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => scrollToSection('company-jobs')}
                  style={{ padding: '8px 16px' }}
                >
                  <i className="ph ph-briefcase" style={{ marginRight: '6px' }} /> Jobs
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => scrollToSection('applications')}
                  style={{ padding: '8px 16px' }}
                >
                  <i className="ph ph-clipboard-text" style={{ marginRight: '6px' }} /> Applications
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => scrollToSection('community-posts')}
                  style={{ padding: '8px 16px' }}
                >
                  <i className="ph ph-users" style={{ marginRight: '6px' }} /> Community
                </button>

                <NotificationBell />

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => openViewProfile()}
                  title="View your own profile"
                  style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="ph ph-user-circle" /> Profile
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsEditProfileOpen(true)}
                  style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="ph ph-pencil-simple" /> Edit Profile
                </button>

                <button
                  type="button"
                  className="btn btn-outline switch-role-btn"
                  onClick={handleSwitchRole}
                  title="One email address has one account type. Switch to the other role by signing in with that account."
                  style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="ph ph-arrows-left-right" /> Switch Role
                </button>
                <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 16px' }}>
                  Logout
                </button>
              </>
            ) : (
              <button className="btn btn-outline login-btn" onClick={() => setIsAuthModalOpen(true)}>
                Sign In
              </button>
            )}
            <button
              className="btn btn-gradient"
              onClick={() => {
                if (!user) {
                  setIsAuthModalOpen(true);
                } else {
                  setIsPostJobModalOpen(true);
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="ph ph-plus" /> Post New Job
            </button>
          </div>
        </div>

        {/* Section offsets for the fixed navbar come from `html { scroll-padding-top }`
            in main.css. Adding scroll-margin-top here as well would stack the two
            and push the section 170px down instead of 80px. */}
        <div id="company-jobs" style={{ marginBottom: '50px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--dark)' }}>Posted Jobs</h2>
          {jobs.length > 0 ? (
            <div style={{ display: 'grid', gap: '20px' }}>              {jobs.map((rawJob) => {
              const job = normalizeJob(rawJob);
              return (
                <div key={job.id} style={{ padding: '20px', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--dark)' }}>{job.title}</h3>
                    <p style={{ color: 'var(--gray)', marginBottom: '8px' }}>
                      <i className="ph ph-map-pin" /> {job.location}
                      {job.workMode && <><span> • </span><i className="ph ph-wifi" /> {job.workMode}</>}
                      {' • '}<i className="ph ph-currency-dollar" /> {job.salary || 'Salary not set'}
                    </p>
                    <p style={{ color: 'var(--gray)', marginBottom: '6px' }}>
                      {job.category || 'Category not set'}
                      {job.workType && ` • ${job.workType}`}
                      {job.experienceLevel && ` • ${job.experienceLevel}`}
                    </p>
                    {job.skills.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        {job.skills.slice(0, 6).map(s => (
                          <span key={s} style={{ padding: '3px 10px', background: 'var(--light-gray)', borderRadius: '20px', fontSize: '0.75rem', color: 'var(--gray)', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    )}
                    <p style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>Posted {job.postedAt ? new Date(job.postedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setEditingJob(job)}
                      style={{ padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="ph ph-pencil-simple" /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleDeleteJob(job.id)}
                      style={{ padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="ph ph-trash" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
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

        <div id="applications">
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
                      {app.applicantUid && (
                        <button
                          type="button"
                          className="btn btn-outline chat-open-btn"
                          onClick={() => messageApplicant(app)}
                          disabled={isOpeningChat}
                          style={{ padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <i className="ph ph-chat-circle-dots" /> Chat with Applicant
                        </button>
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

        {/* Incoming connection requests. A company that cannot act on a
            request is stuck in the same dead end the seeker page was in. */}
        {incomingRequests.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '15px', color: 'var(--dark)' }}>
              <i className="ph ph-user-plus" style={{ color: 'var(--primary)', marginRight: '8px' }} />
              Connection Requests ({incomingRequests.length})
            </h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', flexWrap: 'wrap' }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, overflow: 'hidden', flexShrink: 0 }}>
                    {req.fromPhoto
                      ? <img src={req.fromPhoto} alt={req.fromName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (req.fromName?.[0] || 'U').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--dark)' }}>{req.fromName || 'User'}</h3>
                    <p style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Wants to connect with you</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleAcceptConnection(req.id)}
                      className="btn btn-gradient btn-sm"
                      style={{ padding: '10px 18px' }}
                    >
                      <i className="ph ph-check" style={{ marginRight: '6px' }} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectConnection(req.id)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '10px 18px' }}
                    >
                      <i className="ph ph-x" style={{ marginRight: '6px' }} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Community Posts - same feed + same permissions as the seeker page.
            A company can read every post, like and comment, and create its own
            posts; it still cannot edit or delete anybody else's post. */}
        <div id="community-posts" style={{ marginTop: '50px' }}>
          <div className="section-header" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '6px', color: 'var(--dark)' }}>Community Posts</h2>
            <p style={{ color: 'var(--gray)' }}>Updates and stories from across the JobSphere community</p>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              className="btn btn-gradient"
              onClick={() => setIsPostModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="ph ph-plus" /> Create Post
            </button>
          </div>
          <div className="posts-list">
            {posts.length > 0 ? (
              posts.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  index={index}
                  expandedComments={expandedComments}
                  setExpandedComments={setExpandedComments}
                  comments={comments}
                  setComments={setComments}
                  commentTexts={commentTexts}
                  setCommentTexts={setCommentTexts}
                  isLiking={isLiking}
                  setIsLiking={setIsLiking}
                  isCommenting={isCommenting}
                  setIsCommenting={setIsCommenting}
                  isLoadingComments={isLoadingComments}
                  setIsLoadingComments={setIsLoadingComments}
                  handleLikePost={handleLikePost}
                  toggleComments={toggleComments}
                  loadComments={loadComments}
                  handleAddComment={handleAddComment}
                  formatPostTime={formatPostTime}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-lightbulb" style={{ fontSize: '2.5rem', marginBottom: '15px', display: 'block', opacity: 0.3 }}></i>
                <p>No posts yet. Be the first to share!</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '50px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--dark)' }}>Messages</h2>
          <p style={{ color: 'var(--gray)', marginBottom: '20px' }}>Your conversations with candidates</p>
          <ChatList
            onOpenChat={openExistingChat}
            emptyHint="No conversations yet. Use “Chat with Applicant” on an application to start one."
          />
        </div>
      </div>

      <PostJobModal
        isOpen={isPostJobModalOpen}
        onClose={() => {
          setIsPostJobModalOpen(false);
          if (user) loadCompanyData();
        }}
      />

      {/* Edit an existing job with the same structured fields */}
      <PostJobModal
        isOpen={Boolean(editingJob)}
        job={editingJob}
        onClose={() => setEditingJob(null)}
        onSaved={() => { setEditingJob(null); if (user) loadCompanyData(); }}
      />

      <PostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
expectedRole="company"
      />
      <ChatModal
        isOpen={Boolean(activeChat)}
        chatId={activeChat?.chatId}
        otherUser={activeChat?.otherUser}
        onClose={() => setActiveChat(null)}
      />

      {/* Profile: one viewer shared with the seeker page. */}
      <ViewProfileModal
        isOpen={Boolean(viewProfileUserId)}
        onClose={() => setViewProfileUserId(null)}
        userId={viewProfileUserId}
        onStartChat={(chat) => setActiveChat(chat)}
        onEditProfile={() => setIsEditProfileOpen(true)}
      />
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
};

export default CompanyDashboard;
