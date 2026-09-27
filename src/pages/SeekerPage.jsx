import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  subscribeToJobs,
  fetchUserApplications,
  fetchPosts,
  likePost,
  addComment,
  fetchPostComments,
  formatPostTime,
  subscribeToPosts,
  fetchUserConnections,
  openDirectChat,
  getConnectionPeer,
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  searchUsers,
  subscribeToReceivedRequests,
  subscribeToSentRequests,
  subscribeToConnections,
  subscribeToApplications,
  fetchCurrentUserProfile,
  syncUserDirectoryEntry,
  browseDirectory
} from '../services/firebaseService';
import EditProfileModal from '../components/EditProfileModal';
import {
  EMPTY_FILTERS,
  SALARY_BANDS,
  WORK_TYPES,
  WORK_MODES,
  EXPERIENCE_LEVELS,
  JOB_CATEGORIES,
  collectJobFacets,
  filterJobs,
  getApplicationStatusMeta,
  hasActiveFilters,
  indexApplicationsByJob,
  normalizeJob
} from '../utils/jobFilters';
import PostModal from '../components/PostModal';
import ApplyModal from '../components/ApplyModal';
import JobDetailsModal from '../components/JobDetailsModal';

import AuthModal from '../components/AuthModal';
import ChatList from '../components/ChatList';
import ChatModal from '../components/ChatModal';
import ViewProfileModal from '../components/ViewProfileModal';

const filterLabelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, color: 'var(--dark)', fontSize: '0.8rem' };
const filterSelectStyle = { padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', fontFamily: 'inherit', background: 'white', cursor: 'pointer', minWidth: '160px' };
const filterChipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px',
  borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  background: 'rgba(99,102,241,0.1)', color: 'var(--primary)',
  border: '1px solid rgba(99,102,241,0.25)'
};

export default function SeekerPage() {
  const { user, userData } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  // Authoritative role (Firestore `users/{uid}`), never localStorage.
  const userRole = userData?.role || null;
  // Single source of truth for the job list. Every loader writes here so the
  // search/filter memo can never be out of sync with what is displayed.
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [posts, setPosts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeStatus, setActiveStatus] = useState('all');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState(null);

  // jobId -> application, so every card can show its status without a modal
  const applicationByJobId = useMemo(
    () => indexApplicationsByJob(applications),
    [applications]
  );

  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [isLiking, setIsLiking] = useState({});
  const [isCommenting, setIsCommenting] = useState({});
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [activeChat, setActiveChat] = useState(null); // { chatId, otherUser }
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  // Network / Connections state
  const [isUserSearchModalOpen, setIsUserSearchModalOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState([]);
  // Incoming connection requests, kept live so a request from another member
  // shows up without a manual refresh.
  const [incomingRequests, setIncomingRequests] = useState([]);
  // Outgoing requests. `connections` only ever contains ACCEPTED connections,
  // so without this a member who already sent a request still saw an active
  // "Connect" button and could spam duplicates.
  const [sentRequests, setSentRequests] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionUserId, setConnectionUserId] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [viewProfileUserId, setViewProfileUserId] = useState(null);
  // Edit Profile. The Navbar raised a window event that nothing listened to, so
  // this modal was never reachable; it is now real component state.
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Live job feed. Search + filters run client-side over this authorized list,
  // so both always reflect exactly what is on screen, and a newly posted job
  // appears without a manual refresh.
  useEffect(() => {
    // Jobs require an authenticated caller, so this must re-run once the
    // session resolves. With an empty dependency list the listener was created
    // while signed out, denied by the rules, and never re-created - leaving an
    // empty job list until a manual page refresh.
    if (!user) {
      setJobs([]);
      setIsLoadingJobs(false);
      return undefined;
    }
    const unsubscribe = subscribeToJobs(
      (list) => {
        setJobs(list);
        setIsLoadingJobs(false);
        setJobsError(null);
      },
      (message) => {
        setJobsError(message);
        setIsLoadingJobs(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Facet values are derived from the jobs that are actually loaded, so the
  // filter menus can never offer a value that matches nothing.
  const facets = useMemo(() => collectJobFacets(jobs), [jobs]);

  // Search + all active filters, combined with AND logic.
  const filteredJobs = useMemo(
    () => filterJobs(jobs, { search: searchTerm, filters }),
    [jobs, searchTerm, filters]
  );

  const filtersActive = hasActiveFilters(filters);

  // Human-readable summary of what is currently narrowing the results.
  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (key, label, value) => {
      if (value) chips.push({ key, label, value });
    };
    add('category', 'Category', filters.category);
    add('workType', 'Work Type', filters.workType);
    add('workMode', 'Work Mode', filters.workMode);
    add('experienceLevel', 'Experience', filters.experienceLevel);
    add('location', 'Location', filters.location);
    add('skill', 'Skill', filters.skill);
    // Only a real band counts as active. SALARY_BANDS[0] is the empty
    // "Any salary" option and must not produce a chip.
    if (filters.minSalary) {
      add('minSalary', 'Min Salary', SALARY_BANDS.find(b => b.value === filters.minSalary)?.label);
    }
    return chips;
  }, [filters]);

  // Bring the results into view. The 80px offset that clears the fixed navbar
  // comes from `html { scroll-padding-top }` in main.css, so no pixel maths
  // (and no scroll-margin-top here, which would stack with it) is needed.
  const scrollToJobs = () => {
    const section = document.getElementById('jobs');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // One unambiguous reset: search text plus every active filter. Leaving the
  // search term behind made "Clear Filters" look like it had not worked.
  const clearAll = () => {
    setSearchTerm('');
    setFilters(EMPTY_FILTERS);
  };

  const setFilter = (name, value) => setFilters(prev => ({ ...prev, [name]: value }));

  const handleOpenJobDetails = (job) => {
    setSelectedJobDetails(job);
    setIsJobDetailsModalOpen(true);
  };

  useEffect(() => {
    if (!user) {
      setJobs([]);
      setApplications([]);
      setPosts([]);
      setConnections([]);
      return;
    }

    // The Firestore `users/{uid}` document is the authoritative role source, so
    // a Company account must not get the job seeker dashboard (or the data
    // behind it) just by navigating to this route. Role unknown => keep going.
    if (userRole && userRole !== 'user') {
      setJobs([]);
      setApplications([]);
      setPosts([]);
      setConnections([]);
      showNotification('This account is registered as a Company. Please use the Company page.', 'error');
      navigate('/company');
      return;
    }

    // Posts + connections are loaded independently so one failure cannot block
    // the others. Jobs and applications are handled by their own live listeners.
    const loadPosts = async () => {
      try {
        const { posts: postsData } = await fetchPosts();
        setPosts(postsData);
      } catch (error) {
        console.error('Error fetching posts:', error);
        showNotification('Could not load community posts', 'error');
      }
    };

    loadPosts();

    // Live accepted connections, so a request accepted by the other person
    // shows up without a refresh.
    const unsubscribeConnections = subscribeToConnections(
      user.uid,
      setConnections,
      (message) => showNotification(message, 'error')
    );

    // Subscribe to real-time posts updates (new posts appear without a refresh)
    const unsubscribe = subscribeToPosts(
      (posts) => setPosts(posts),
      (message) => showNotification(message, 'error')
    );

    // Live incoming connection requests (the recipient must be able to act on
    // them, otherwise a request can never be accepted).
    const unsubscribeRequests = subscribeToReceivedRequests(
      user.uid,
      setIncomingRequests,
      (message) => showNotification(message, 'error')
    );

    // Live outgoing requests, so "Request Sent" state is accurate.
    const unsubscribeSent = subscribeToSentRequests(
      user.uid,
      setSentRequests,
      (message) => showNotification(message, 'error')
    );

    // Live applications. Without this the status badge on a job card would be
    // frozen at whatever it was when the page loaded, so a company accepting or
    // rejecting an application would never be reflected on the card.
    const unsubscribeApps = subscribeToApplications(
      user.uid,
      (list) => setApplications(list),
      (message) => showNotification(message, 'error')
    );

    return () => {
      unsubscribe();
      unsubscribeRequests();
      unsubscribeSent();
      unsubscribeApps();
      unsubscribeConnections();
    };
  }, [user, userRole]);

  const handleApplyClick = (job) => {
    if (!job?.id) return;
    // Duplicate applications are prevented in the UI, in JobDetailsModal and
    // again in the service layer - this is the last line of defence.
    if (applicationByJobId[job.id] || applyInFlightRef.current) return;
    setSelectedJob(job);
    setIsApplyModalOpen(true);
  };

  const handleCreatePostClick = () => {
    // Signed out users get the sign-in flow instead of a post that cannot be saved
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsPostModalOpen(true);
  };

  // ── MESSAGING ────────────────────────────────────────────────────────────
  // Opens (or reuses) the one-to-one conversation with another account and
  // shows the chat. The conversation id is derived from both uids, so repeated
  // clicks always reuse the same document instead of creating duplicates.
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

  // Message the company that received an application.
  const messageCompany = (app) => startChat(app.companyUid, app.companyName || app.company || 'Company', '');

  // Message a connection from the network list.
  const messageConnection = (conn) => {
    const peer = getConnectionPeer(conn, user?.uid);
    return startChat(peer.uid, peer.name, peer.photo);
  };

  // Network / Connections handlers
  const handleConnect = async (userId, userName, userPhoto) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const requestId = await sendConnectionRequest(userId, userName, userPhoto);
      setConnectionUserId(userId);
      setPendingRequest({
        id: requestId,
        from: userId,
        fromName: userName,
        fromPhoto: userPhoto,
        status: 'pending'
      });
      setIsUserSearchModalOpen(false);
      showNotification('Connection request sent!', 'success');
    } catch (e) {
      console.error('Failed to send connection request:', e);
      showNotification(e?.message || 'Failed to send connection request', 'error');
    }
  };

  // Applying again must be impossible even if a stale card is clicked twice.
  const applyInFlightRef = useRef(false);

  const handleAcceptConnection = async (requestId) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      await acceptConnection(requestId);
      setPendingRequest(null);
      setConnectionUserId(null);
      setSearchedUsers([]);
      // The live request listener drops the accepted request on its own.
      const connectionsData = await fetchUserConnections(user.uid);
      setConnections(connectionsData);
      showNotification('Connection accepted!', 'success');
    } catch (e) {
      console.error('Failed to accept connection:', e);
      showNotification('Failed to accept connection', 'error');
    }
  };

  const handleRejectConnection = async (requestId) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      await rejectConnection(requestId);
      setPendingRequest(null);
      setConnectionUserId(null);
      setSearchedUsers([]);
      showNotification('Connection request declined.', 'info');
    } catch (e) {
      console.error('Failed to reject connection:', e);
      showNotification('Failed to reject connection', 'error');
    }
  };

  // Search for users to connect with. Searches the public member directory.
  const handleSearchUsers = async (searchTerm) => {
    const term = (searchTerm || '').trim();

    setIsSearching(true);
    try {
      // An empty query shows suggestions instead of a dead-end message.
      const users = term
        ? await searchUsers(term, user?.uid)
        : await browseDirectory(user?.uid);
      setSearchedUsers(users);
    } catch (e) {
      console.error('Failed to search users:', e);
      showNotification('Failed to search members', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Load suggestions as soon as the Find People dialog opens.
  useEffect(() => {
    if (isUserSearchModalOpen && user) {
      handleSearchUsers('');
    }
  }, [isUserSearchModalOpen, user]);

  // Handle Enter key on search input
  const handleSearchKeydown = (e) => {
    if (e.key === 'Enter') {
      handleSearchUsers(userSearchTerm);
    }
  };

  // Clear search results
  const clearSearch = () => {
    setUserSearchTerm('');
    setSearchedUsers([]);
  };

  // Open View Profile Modal
  const openViewProfile = (userId) => {
    if (userId) {
      setViewProfileUserId(userId);
    }
  };

  // Re-publish my own public directory entry after a profile edit so the new
  // details become discoverable in Find People straight away.
  // updateUserProfile() already refreshes it, so this is a safety net for the
  // case where the saved profile came from somewhere else.
  const refreshMyDirectoryEntry = async () => {
    if (!user) return;
    try {
      const own = await fetchCurrentUserProfile();
      if (own) {
        await syncUserDirectoryEntry(
          { name: own.name, photo: own.photo, role: own.role },
          own.profile || null
        );
      }
    } catch (error) {
      console.error('Could not refresh the member directory entry:', error);
    }
  };

  // The Navbar raises these events; the page owns the modals behind them.
  useEffect(() => {
    const openEdit = () => setIsEditProfileOpen(true);
    const viewOwn = () => user && setViewProfileUserId(user.uid);
    window.addEventListener('open-edit-profile', openEdit);
    window.addEventListener('view-own-profile', viewOwn);
    return () => {
      window.removeEventListener('open-edit-profile', openEdit);
      window.removeEventListener('view-own-profile', viewOwn);
    };
  }, [user]);

  // Open an existing conversation from the message list.
  const openExistingChat = (chatId, otherUser) => setActiveChat({ chatId, otherUser });

  // Toggle like on a post
  const handleLikePost = async (postId) => {
    if (isLiking[postId]) return;
    setIsLiking(prev => ({ ...prev, [postId]: true }));
    try {
      await likePost(postId);
      // Real-time subscription will update the posts
    } catch (error) {
      console.error('Error liking post:', error);
      showNotification('Failed to like post', 'error');
    } finally {
      setIsLiking(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Toggle comments visibility
  const toggleComments = (postId) => {
    setExpandedComments(prev => {
      const newState = { ...prev, [postId]: !prev[postId] };
      if (newState[postId] && !comments[postId]) {
        // Load comments when expanding
        loadComments(postId);
      }
      return newState;
    });
  };

  // Load comments for a post
  const loadComments = async (postId) => {
    setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
    try {
      const commentsData = await fetchPostComments(postId);
      setComments(prev => ({ ...prev, [postId]: commentsData }));
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Add a comment to a post
  const handleAddComment = async (postId) => {
    const text = commentTexts[postId]?.trim();
    if (!text || isCommenting[postId]) return;

    setIsCommenting(prev => ({ ...prev, [postId]: true }));
    try {
      await addComment(postId, text);
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      // Real-time subscription will update the post's commentCount
      // Reload comments to show the new one
      const commentsData = await fetchPostComments(postId);
      setComments(prev => ({ ...prev, [postId]: commentsData }));
    } catch (error) {
      console.error('Error adding comment:', error);
      showNotification('Failed to add comment', 'error');
    } finally {
      setIsCommenting(prev => ({ ...prev, [postId]: false }));
    }
  };

  return (
    <div className="seeker-page">
      <Navbar
        user={user}
        userData={userData}
        onAuthClick={() => setIsAuthModalOpen(true)}
      />

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              <i className="ph ph-trend-up"></i> #1 Job Platform in 2026
            </div>
            <h1>Find the perfect job that matches your <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>passion</span></h1>
            <p>Join thousands of professionals who found their dream roles through our intelligent matching system.</p>
            <div className="search-box">
              <i className="ph ph-magnifying-glass" style={{ fontSize: '1.2rem', color: 'var(--gray)', marginLeft: '20px' }}></i>
              <input
                type="text"
                className="search-input"
                id="jobSearch"
                aria-label="Search jobs"
                placeholder="Job title, keyword, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') scrollToJobs(); }}
              />
              <button
                type="button"
                className="search-btn"
                aria-label="Search jobs"
                onClick={scrollToJobs}
              >
                <i className="ph ph-arrow-right"></i>
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="floating-card">
              <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg,#fee2e2,#fecaca)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}><i className="ph-fill ph-google-logo" style={{ fontSize: '1.5rem' }}></i></div>
              <div><h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>Google</h4><span style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>Senior Designer</span></div>
            </div>
            <div className="floating-card">
              <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><i className="ph-fill ph-user-circle" style={{ fontSize: '1.5rem' }}></i></div>
              <div><h4 style={{ fontSize: '0.95rem', marginBottom: '20px' }}>Sarah L.</h4><span style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>Just Hired!</span></div>
            </div>
            <div className="floating-card" style={{ background: 'var(--dark)', color: 'white' }}>
              <i className="ph-fill ph-check-circle" style={{ color: 'var(--success)' }}></i>
              <span style={{ fontWeight: '600' }}>Hired Successfully</span>
            </div>
          </div>
        </div>
        <div className="container">
          <div className="stats-bar">
            <div className="stats-grid">
              <div className="stat-item"><h3>25k+</h3><p>Live Jobs</p></div>
              <div className="stat-item"><h3>14k+</h3><p>Companies</p></div>
              <div className="stat-item"><h3>50k+</h3><p>Candidates</p></div>
              <div className="stat-item"><h3>98%</h3><p>Hired Rate</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs Section */}
      <section className="jobs-section" id="jobs">
        <div className="container">
          <div className="section-header">
            <h2>Featured Opportunities</h2>
            <p style={{ color: 'var(--gray)' }}>Curated high-impact roles from innovative companies</p>
          </div>

          {/* The search box that belongs with the results.
              It is the SAME `searchTerm` state as the hero box, so typing in
              either one filters the list below. Previously the only input lived
              ~600px above the results (up in the hero), so after using the
              "Find Jobs" nav link there was no visible way to search. */}
          <div className="jobs-search" style={{ display: 'flex', gap: '10px', marginBottom: '18px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray)', fontSize: '1.1rem', pointerEvents: 'none' }}></i>
              <input
                type="text"
                id="jobsSearchInput"
                aria-label="Search jobs"
                placeholder="Search by job title, company, location, skill..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...filterSelectStyle, width: '100%', minWidth: '0', paddingLeft: '42px' }}
              />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="btn btn-outline"
                style={{ padding: '11px 18px', whiteSpace: 'nowrap' }}
                aria-label="Clear search"
              >
                <i className="ph ph-x" style={{ marginRight: '6px' }} /> Clear
              </button>
            )}
          </div>
          {/* Filter options are FIXED by the application (see src/utils/jobFilters.js).
              They do not change depending on which jobs currently exist, so
              posting a single job can never reshape the menus for every seeker.
              Only Location and Skill are derived, because a city or a technology
              genuinely cannot be enumerated up front. */}
          <div className="job-filters" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="filterCategory" style={filterLabelStyle}>Category</label>
              <select id="filterCategory" value={filters.category} onChange={e => setFilter('category', e.target.value)} style={filterSelectStyle}>
                <option value="">All categories</option>
                {JOB_CATEGORIES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterWorkType" style={filterLabelStyle}>Work Type</label>
              <select id="filterWorkType" value={filters.workType} onChange={e => setFilter('workType', e.target.value)} style={filterSelectStyle}>
                <option value="">All work types</option>
                {WORK_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterWorkMode" style={filterLabelStyle}>Work Mode</label>
              <select id="filterWorkMode" value={filters.workMode} onChange={e => setFilter('workMode', e.target.value)} style={filterSelectStyle}>
                <option value="">All work modes</option>
                {WORK_MODES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterExperience" style={filterLabelStyle}>Experience</label>
              <select id="filterExperience" value={filters.experienceLevel} onChange={e => setFilter('experienceLevel', e.target.value)} style={filterSelectStyle}>
                <option value="">Any experience</option>
                {EXPERIENCE_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterLocation" style={filterLabelStyle}>Location</label>
              <select id="filterLocation" value={filters.location} onChange={e => setFilter('location', e.target.value)} style={filterSelectStyle}>
                <option value="">All locations</option>
                {facets.locations.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterSkill" style={filterLabelStyle}>Skill</label>
              <select id="filterSkill" value={filters.skill} onChange={e => setFilter('skill', e.target.value)} style={filterSelectStyle}>
                <option value="">Any skill</option>
                {facets.skills.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filterSalary" style={filterLabelStyle}>Minimum Salary</label>
              <select id="filterSalary" value={filters.minSalary} onChange={e => setFilter('minSalary', e.target.value)} style={filterSelectStyle}>
                {SALARY_BANDS.map(b => <option key={b.value || 'any'} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            {(filtersActive || searchTerm.trim()) && (
              <button
                type="button"
                onClick={clearAll}
                className="btn btn-outline"
                style={{ padding: '12px 20px' }}
                title="Remove the search text and every active filter"
              >
                <i className="ph ph-arrow-counter-clockwise" style={{ marginRight: '8px' }} /> Clear All
              </button>
            )}
          </div>

          <p style={{ color: 'var(--gray)', fontSize: '0.9rem', marginBottom: '10px' }}>
            {searchTerm.trim() || filtersActive
              ? `Showing ${filteredJobs.length} of ${jobs.length} job${jobs.length === 1 ? '' : 's'}`
              : `${jobs.length} job${jobs.length === 1 ? '' : 's'} available`}
          </p>

          {/* Active-filter chips, so it is always obvious what is narrowing the
              results. Each one can be removed on its own. */}
          {(searchTerm.trim() || activeFilterChips.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 600 }}>Active:</span>
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ ...filterChipStyle }}
                  title="Remove the search term"
                >
                  Search: &quot;{searchTerm.trim()}&quot; <i className="ph ph-x" />
                </button>
              )}
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key, '')}
                  style={{ ...filterChipStyle }}
                  title={`Remove the ${chip.label} filter`}
                >
                  {chip.label}: {chip.value} <i className="ph ph-x" />
                </button>
              ))}
            </div>
          )}
          <div className="jobs-grid" id="jobsGrid">
            {isLoadingJobs && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }} />
                <p style={{ color: 'var(--gray)' }}>Loading jobs...</p>
              </div>
            )}
            {jobsError && !isLoadingJobs && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#ef4444' }}>
                <i className="ph ph-warning-circle" style={{ fontSize: '3rem', marginBottom: '15px', display: 'block' }}></i>
                <p>{jobsError}</p>
                <button onClick={() => window.location.reload()} className="btn btn-outline" style={{ marginTop: '15px' }}>Retry</button>
              </div>
            )}
            {!isLoadingJobs && !jobsError && filteredJobs.map((job, index) => {
              const view = normalizeJob(job);
              const application = applicationByJobId[job.id];
              const statusMeta = application ? getApplicationStatusMeta(application.status) : null;
              return (
                <div className="job-card" key={job.id || index} onClick={() => handleOpenJobDetails(job)} style={{ cursor: 'pointer' }}>
                  <div className="company-logo" style={{
                    background: job.logoUrl ? 'none' : `linear-gradient(135deg, ${job.color1 || '#667eea'}, ${job.color2 || '#764ba2'})`,
                    color: job.color || 'var(--primary)'
                  }}>
                    {job.logoUrl ? (
                      <img src={job.logoUrl} alt={job.company} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <i className={job.icon || 'ph-fill ph-buildings'} style={{ fontSize: '1.5rem' }} />
                    )}
                  </div>
                  <div className="job-main">
                    <h3>{view.title}</h3>
                    <div className="job-tags">
                      <span><i className="ph-fill ph-map-pin"></i> {view.location}</span>
                      <span><i className="ph-fill ph-buildings"></i> {view.company}</span>
                      {view.category && <span><i className="ph-fill ph-briefcase"></i> {view.category}</span>}
                      {view.workType && <span><i className="ph-fill ph-clock"></i> {view.workType}</span>}
                      {view.workMode && <span><i className="ph-fill ph-wifi"></i> {view.workMode}</span>}
                      {view.experienceLevel && <span><i className="ph-fill ph-chart-bar"></i> {view.experienceLevel}</span>}
                    </div>
                    {view.skills.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {view.skills.slice(0, 5).map(skill => (
                          <span key={skill} style={{ padding: '4px 10px', background: 'var(--light-gray)', borderRadius: '20px', fontSize: '0.75rem', color: 'var(--gray)', fontWeight: 600 }}>{skill}</span>
                        ))}
                        {view.skills.length > 5 && (
                          <span style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--gray)' }}>+{view.skills.length - 5} more</span>
                        )}
                      </div>
                    )}
                    <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                      {view.description?.substring(0, 150) || 'Click to view details...'}
                    </p>
                    {/* Application status, visible without opening Job Details */}
                    {application && (
                      <p style={{ marginTop: '12px' }}>
                        <span className={`status-badge ${statusMeta.className}`}>
                          <i className="ph-fill ph-check-circle" style={{ marginRight: '5px' }} />
                          Application Status: {statusMeta.label}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="job-right">
                    {view.salary && <span className="salary-range">{view.salary}</span>}
                    <button
                      type="button"
                      className="btn btn-gradient apply-btn"
                      onClick={(e) => { e.stopPropagation(); handleApplyClick(job); }}
                      disabled={Boolean(application)}
                      style={{ marginTop: '10px' }}
                    >
                      {application ? statusMeta.label : 'Apply Now'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleOpenJobDetails(job); }}
                      style={{ marginTop: '8px', width: '100%' }}
                    >
                      View Job
                    </button>
                  </div>
                </div>
              );
            })}
            {!isLoadingJobs && !jobsError && filteredJobs.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-inbox" style={{ fontSize: '3rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
                <p>{searchTerm.trim() || filtersActive ? 'No jobs found matching your search and filters' : 'No jobs available at the moment'}</p>
                {(searchTerm.trim() || filtersActive) && (
                  <button onClick={clearAll} className="btn btn-outline" style={{ marginTop: '15px' }}>
                    <i className="ph ph-arrow-counter-clockwise" style={{ marginRight: '8px' }} /> Clear Search &amp; Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Applications Section */}
      <section className="applications-section" id="applications">
        <div className="container">
          <div className="section-header">
            <h2>My Applications</h2>
            <p style={{ color: 'var(--gray)' }}>Track your job applications and their status</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button className={`filter-btn ${activeStatus === 'all' ? 'active' : ''}`} onClick={() => setActiveStatus('all')}>
              All Applications
            </button>
            <button className={`filter-btn ${activeStatus === 'pending' ? 'active' : ''}`} onClick={() => setActiveStatus('pending')}>
              Pending
            </button>
            <button className={`filter-btn ${activeStatus === 'reviewed' ? 'active' : ''}`} onClick={() => setActiveStatus('reviewed')}>
              Reviewed
            </button>
            <button className={`filter-btn ${activeStatus === 'interview' ? 'active' : ''}`} onClick={() => setActiveStatus('interview')}>
              Interview
            </button>
          </div>
          <div className="applications-grid">
            {applications.length > 0 ? (
              applications
                .filter(app => {
                  if (activeStatus === 'all') return true;
                  if (activeStatus === 'pending') return app.status === 'pending';
                  if (activeStatus === 'reviewed') return app.status === 'accepted' || app.status === 'rejected';
                  if (activeStatus === 'interview') return app.status === 'interview';
                  return true;
                })
                .map((app, index) => (
                  <div className="application-card" key={app.id || index}>
                    <div className="application-header">
                      <h4>{app.jobTitle || 'Job Application'}</h4>
                      <span className={`status-badge ${app.status || 'pending'}`}>{app.status || 'Pending'}</span>
                    </div>
                    <div className="application-details">
                      <p><strong>Company:</strong> {app.companyName || app.company || 'N/A'}</p>
                      <p><strong>Applied:</strong> {
                        app.appliedAt ? new Date(app.appliedAt.seconds ? app.appliedAt.seconds * 1000 : app.appliedAt).toLocaleDateString() :
                        app.timestamp ? new Date(app.timestamp.seconds ? app.timestamp.seconds * 1000 : app.timestamp).toLocaleDateString() :
                        'Recently'
                      }</p>
                    </div>
                    {app.companyUid && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm chat-open-btn"
                        onClick={() => messageCompany(app)}
                        disabled={isOpeningChat}
                        style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <i className="ph ph-chat-circle-dots"></i> Chat with Company
                      </button>
                    )}
                  </div>
                ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-inbox" style={{ fontSize: '3rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
                <p>No applications yet. Start applying to jobs!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Posts Section */}
      <section className="posts-section" id="posts">
        <div className="container">
          <div className="section-header">
            <h2>Community Posts</h2>
            <p style={{ color: 'var(--gray)' }}>Achievements, updates, and stories from our community</p>
          </div>
          <div className="section-actions">
            <button
              className="btn btn-gradient"
              onClick={handleCreatePostClick}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="ph ph-plus"></i>
              Create Post
            </button>
          </div>
          <div className="posts-list" style={{ marginTop: '30px' }}>
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
                <i className="ph ph-lightbulb" style={{ fontSize: '2.5rem', marginBottom: '15px', display: 'block', opacity: '0.3' }}></i>
                <p>No posts yet. Be the first to share!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Network Section */}
      <section className="network-section" id="network">
        <div className="container">
          <div className="section-header">
            <h2>Professional Network</h2>
            <p style={{ color: 'var(--gray)' }}>Build meaningful connections in your industry</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button className="btn btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsUserSearchModalOpen(true)}>
              <i className="ph ph-user-plus"></i>
              Find People
            </button>
            <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => showNotification('Groups feature coming soon! Join our network to see available groups.', 'info')}>
              <i className="ph ph-users"></i>
              Find Groups
            </button>
          </div>

          {/* Incoming requests: without this a request can never be accepted. */}
          {incomingRequests.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--dark)', marginBottom: '15px' }}>
                <i className="ph ph-user-plus" style={{ color: 'var(--primary)', marginRight: '8px' }} />
                Connection Requests ({incomingRequests.length})
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {incomingRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, overflow: 'hidden', flexShrink: 0 }}>
                      {req.fromPhoto
                        ? <img src={req.fromPhoto} alt={req.fromName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (req.fromName?.[0] || 'U').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--dark)' }}>{req.fromName || 'User'}</h4>
                      <p style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Wants to connect with you</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => handleAcceptConnection(req.id)} className="btn btn-gradient btn-sm" style={{ padding: '10px 18px' }}>
                        <i className="ph ph-check" style={{ marginRight: '6px' }} /> Accept
                      </button>
                      <button type="button" onClick={() => handleRejectConnection(req.id)} className="btn btn-outline btn-sm" style={{ padding: '10px 18px' }}>
                        <i className="ph ph-x" style={{ marginRight: '6px' }} /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="connections-grid">
            {connections.length > 0 ? (
              connections.map((connection, index) => {
                const peer = getConnectionPeer(connection, user?.uid);
                return (
                <div className="connection-card" key={connection.id || index}>
                  <div className="connection-info">
                    <div className="connection-avatar">
                      {peer.photo ? (
                        <img src={peer.photo} alt={peer.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <i className="ph-fill ph-user-circle" style={{ fontSize: '1.5rem' }}></i>
                      )}
                    </div>
                    <div>
                      <h4>{peer.name}</h4>
                      <p style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
                        {connection.title || connection.role || connection.industry || 'Professional'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openViewProfile(peer.uid)}
                      style={{ minWidth: '100px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <i className="ph ph-eye"></i> Profile
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm chat-open-btn"
                      onClick={() => messageConnection(connection)}
                      disabled={isOpeningChat}
                      style={{ minWidth: '100px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <i className="ph ph-chat-circle-dots"></i> Message
                    </button>
                  </div>
                </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-network" style={{ fontSize: '3rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
                <p>No connections yet. Start building your network!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Messages Section */}
      <section className="messages-section" id="messages">
        <div className="container">
          <div className="section-header">
            <h2>Messages</h2>
            <p style={{ color: 'var(--gray)' }}>Your conversations with companies and candidates</p>
          </div>
          <div className="container" style={{ maxWidth: '720px', padding: 0 }}>
            <ChatList
              onOpenChat={openExistingChat}
              emptyHint="No conversations yet. Use “Chat with Company” on an application to start one."
            />
          </div>
        </div>
      </section>

      {/* Modals */}
      <PostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
      />
      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={async () => {
          setIsApplyModalOpen(false);
          // Reload applications so the card status updates immediately
          if (user) {
            try {
              const applicationsData = await fetchUserApplications(user.uid);
              setApplications(applicationsData);
            } catch (error) {
              console.error('Error fetching user applications:', error);
            }
          }
        }}
        job={selectedJob}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
expectedRole="user"
      />

      <ChatModal
        isOpen={Boolean(activeChat)}
        chatId={activeChat?.chatId}
        otherUser={activeChat?.otherUser}
        onClose={() => setActiveChat(null)}
      />

      {/* User Search Modal for Connections */}
      {isUserSearchModalOpen && (
        <div
          className="modal-wrap active"
          id="userSearchModal"
          onClick={() => setIsUserSearchModalOpen(false)}
        >
          <div className="modal-box" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Find People to Connect</h3>
              <button onClick={() => { setIsUserSearchModalOpen(false); clearSearch(); }} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search by name, job title, company or skill..."
                value={userSearchTerm}
                onChange={(e) => {
                  setUserSearchTerm(e.target.value);
                }}
                onKeyDown={handleSearchKeydown}
                style={{ flex: 1, padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem' }}
              />
              <button
                type="button"
                onClick={() => handleSearchUsers(userSearchTerm)}
                disabled={isSearching}
                className="btn btn-gradient"
                style={{ padding: '12px 20px' }}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {isSearching && searchedUsers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gray)' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '0.9rem' }}>Loading members...</p>
              </div>
            )}

            {searchedUsers.length > 0 && (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {searchedUsers.map((u) => {
                  const isSelf = u.uid === user?.uid;
                  // Accepted connections come from `connections`; a pending
                  // request I sent comes from `sentRequests`. Both must be
                  // checked or the row would offer a duplicate Connect.
                  const alreadyConnected = connections.some(c => c.from === u.uid || c.to === u.uid);
                  const requestSent = sentRequests.some(c => c.to === u.uid);
                  // A request they sent to me can be actioned right here.
                  const requestReceived = incomingRequests.some(c => c.from === u.uid);
                  const subtitle = u.role === 'company'
                    ? ['Company', u.company].filter(Boolean).join(' • ')
                    : [u.jobTitle, u.location].filter(Boolean).join(' • ') || 'Professional';
                  return (
                  <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '1.2rem', overflow: 'hidden', flexShrink: 0 }}>
                      {u.photo ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.name?.[0] || 'U').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || 'Unknown User'}</h4>
                      <p style={{ margin: '4px 0 0', color: 'var(--gray)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {subtitle}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => openViewProfile(u.uid)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
                        disabled={isSelf}
                      >
                        <i className="ph ph-eye"></i> Profile
                      </button>
                      {alreadyConnected ? (
                        <button type="button" onClick={() => startChat(u.uid, u.name, u.photo)} className="btn btn-outline btn-sm" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                          <i className="ph ph-chat-circle-dots"></i> Message
                        </button>
                      ) : requestReceived ? (
                        <>
                          <button type="button" onClick={() => handleAcceptConnection(incomingRequests.find(c => c.from === u.uid)?.id)} className="btn btn-gradient btn-sm" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                            <i className="ph ph-check"></i> Accept
                          </button>
                          <button type="button" onClick={() => handleRejectConnection(incomingRequests.find(c => c.from === u.uid)?.id)} className="btn btn-outline btn-sm" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                            Decline
                          </button>
                        </>
                      ) : requestSent ? (
                        <button type="button" className="btn btn-outline btn-sm" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }} disabled>
                          <i className="ph ph-clock"></i> Request Sent
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnect(u.uid, u.name, u.photo)}
                          className="btn btn-gradient"
                          style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
                          disabled={isSelf}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {!searchedUsers.length && !isSearching && userSearchTerm.trim() && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-user-circle" style={{ fontSize: '3rem', marginBottom: '15px', display: 'block', opacity: '0.4' }}></i>
                <p>No members found matching "{userSearchTerm}"</p>
                <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>
                  Search matches a member&apos;s published name, job title, company, headline or skills.
                </p>
              </div>
            )}

            {!searchedUsers.length && !isSearching && !userSearchTerm.trim() && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-magnifying-glass" style={{ fontSize: '3rem', marginBottom: '15px', display: 'block', opacity: '0.4' }}></i>
                <p>No other members have published a profile yet.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>
                  Members appear here automatically once they sign in.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* One profile viewer, reachable from Find People, the connections list
          and the Navbar's "View Profile" action. */}
      <ViewProfileModal
        isOpen={Boolean(viewProfileUserId)}
        onClose={() => setViewProfileUserId(null)}
        userId={viewProfileUserId}
        onStartChat={(chat) => { setIsOpeningChat(false); setActiveChat(chat); }}
        onEditProfile={() => setIsEditProfileOpen(true)}
      />

      {/* Edit Profile - the Navbar previously fired an event nothing listened to. */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSaved={() => {
          // Refresh the public projection so Find People shows the new details.
          refreshMyDirectoryEntry();
        }}
      />

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={isJobDetailsModalOpen}
        onClose={() => setIsJobDetailsModalOpen(false)}
        job={selectedJobDetails}
        application={selectedJobDetails ? applicationByJobId[selectedJobDetails.id] || null : null}
        onApplicationChange={async () => {
          if (!user) return;
          try {
            setApplications(await fetchUserApplications(user.uid));
          } catch (error) {
            console.error('Error refreshing applications:', error);
          }
        }}
      />
    </div>
  );
}
