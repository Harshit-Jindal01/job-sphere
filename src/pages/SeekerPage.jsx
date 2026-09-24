import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { fetchJobs, fetchUserApplications, fetchUserPosts, fetchUserConnections, applyToJob, createPost } from '../services/firebaseService';
import PostModal from '../components/PostModal';
import ApplyModal from '../components/ApplyModal';

export default function SeekerPage() {
  const { user, userData } = useAuth();
  const { showNotification } = useNotification();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [posts, setPosts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    // Fetch jobs
    const loadJobs = async () => {
      try {
        const jobsData = await fetchJobs();
        setJobs(jobsData);
        setFilteredJobs(jobsData);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        showNotification('Failed to load jobs', 'error');
      }
    };

    loadJobs();

    // Fetch user data if logged in
    if (user) {
      const loadUserData = async () => {
        try {
          const applicationsData = await fetchUserApplications(user.uid);
          setApplications(applicationsData);
          
          const postsData = await fetchUserPosts(user.uid);
          setPosts(postsData);
          
          const connectionsData = await fetchUserConnections(user.uid);
          setConnections(connectionsData);
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };
      loadUserData();
    }
  }, [user, showNotification]);

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setFilteredJobs(jobs);
    } else {
      const filtered = jobs.filter(job => {
        if (filter === 'remote') return job.location.toLowerCase().includes('remote');
        if (filter === 'full-time') return job.type === 'Full-time';
        if (filter === 'design') return job.title.toLowerCase().includes('design');
        if (filter === 'engineering') return job.title.toLowerCase().includes('engineer');
        return false;
      });
      setFilteredJobs(filtered);
    }
  };

  const handleApplyClick = (job) => {
    setSelectedJob(job);
    setIsApplyModalOpen(true);
  };

  const handlePostSubmit = async (content, imageUrl) => {
    try {
      await createPost(content, imageUrl, user.uid);
      showNotification('Post created successfully!', 'success');
      setIsPostModalOpen(false);
      
      // Refresh posts
      const postsData = await fetchUserPosts(user.uid);
      setPosts(postsData);
    } catch (error) {
      console.error('Error creating post:', error);
      showNotification('Failed to create post', 'error');
    }
  };

  return (
    <div className="seeker-page">
      <Navbar user={user} userData={userData} />

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content" data-aos="fade-right" data-aos-duration="1000">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              <i className="ph ph-trend-up"></i> #1 Job Platform in 2026
            </div>
            <h1>Find the perfect job that matches your <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>passion</span></h1>
            <p>Join thousands of professionals who found their dream roles through our intelligent matching system.</p>
            <div className="search-box">
              <i className="ph ph-magnifying-glass" style={{ fontSize: '1.2rem', color: 'var(--gray)', marginLeft: '20px' }}></i>
              <input type="text" className="search-input" id="jobSearch" placeholder="Job title, keyword, or company..." />
              <button className="search-btn"><i className="ph ph-arrow-right"></i></button>
            </div>
          </div>
          <div className="hero-visual" data-aos="fade-left" data-aos-duration="1000">
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
          <div className="stats-bar" data-aos="fade-up" data-aos-delay="200">
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
          <div className="section-header" data-aos="fade-up">
            <h2>Featured Opportunities</h2>
            <p style={{ color: 'var(--gray)' }}>Curated high-impact roles from innovative companies</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => handleFilterClick('all')}>All Jobs</button>
            <button className={`filter-btn ${activeFilter === 'remote' ? 'active' : ''}`} onClick={() => handleFilterClick('remote')}>Remote</button>
            <button className={`filter-btn ${activeFilter === 'full-time' ? 'active' : ''}`} onClick={() => handleFilterClick('full-time')}>Full-time</button>
            <button className={`filter-btn ${activeFilter === 'design' ? 'active' : ''}`} onClick={() => handleFilterClick('design')}>Design</button>
            <button className={`filter-btn ${activeFilter === 'engineering' ? 'active' : ''}`} onClick={() => handleFilterClick('engineering')}>Engineering</button>
          </div>
          <div className="jobs-grid" id="jobsGrid">
            {filteredJobs.map((job, index) => (
              <div className="job-card" key={job.id || index} data-aos="fade-up" data-aos-delay={100 + index * 50}>
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
                  <h3>{job.title}</h3>
                  <div className="job-tags">
                    <span><i className="ph-fill ph-map-pin"></i> {job.location}</span>
                    <span><i className="ph-fill ph-buildings"></i> {job.company}</span>
                    {job.type && <span><i className="ph-fill ph-clock"></i> {job.type}</span>}
                  </div>
                  <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                    {job.description?.substring(0, 150) || 'Click to view details...'}
                  </p>
                </div>
                <div className="job-right">
                  {job.salaryRange && <span className="salary-range">{job.salaryRange}</span>}
                  <button 
                    className="btn btn-gradient apply-btn" 
                    onClick={() => handleApplyClick(job)}
                    disabled={applications.some(app => app.jobId === job.id)}
                  >
                    {applications.some(app => app.jobId === job.id) ? 'Applied' : 'Apply Now'}
                  </button>
                </div>
              </div>
            ))}
            {filteredJobs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-inbox" style={{ fontSize: '3rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
                <p>No jobs found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Applications Section */}
      <section className="applications-section" id="applications">
        <div className="container">
          <div className="section-header" data-aos="fade-up">
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
              applications.map((app, index) => (
                <div className="application-card" key={app.id || index} data-aos="fade-up" data-aos-delay={100 + index * 50}>
                  <div className="application-header">
                    <h4>{app.jobTitle || 'Job Application'}</h4>
                    <span className={`status-badge ${app.status || 'pending'}`}>{app.status || 'Pending'}</span>
                  </div>
                  <div className="application-details">
                    <p><strong>Company:</strong> {app.company || 'N/A'}</p>
                    <p><strong>Applied:</strong> {app.timestamp ? new Date(app.timestamp.seconds ? app.timestamp.seconds * 1000 : app.timestamp).toLocaleDateString() : 'Recently'}</p>
                  </div>
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
          <div className="section-header" data-aos="fade-up">
            <h2>My Posts</h2>
            <p style={{ color: 'var(--gray)' }}>Share updates and connect with professionals</p>
          </div>
          <div className="section-actions" data-aos="fade-up" data-aos-delay="100">
            <button 
              className="btn btn-gradient" 
              onClick={() => setIsPostModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="ph ph-plus"></i>
              Create Post
            </button>
          </div>
          <div className="posts-list" style={{ marginTop: '30px' }}>
            {posts.length > 0 ? (
              posts.map((post, index) => (
                <div className="post-card" key={post.id || index} data-aos="fade-up" data-aos-delay={100 + index * 50}>
                  <div className="post-header">
                    <div className="post-avatar">
                      <i className="ph-fill ph-user-circle" style={{ fontSize: '1.5rem' }}></i>
                    </div>
                    <div className="post-info">
                      <h4>{user?.displayName || 'You'}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                        {post.timestamp ? new Date(post.timestamp.seconds ? post.timestamp.seconds * 1000 : post.timestamp).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                  </div>
                  <div className="post-content">
                    <p>{post.content || post.text || 'No content'}</p>
                  </div>
                  {post.imageUrl && (
                    <div className="post-image">
                      <img src={post.imageUrl} alt="Post image" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-lightbulb" style={{ fontSize: '2.5rem', marginBottom: '15px', display: 'block', opacity: '0.3' }}></i>
                <p>No posts yet. Create your first post to connect with the community!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Network Section */}
      <section className="network-section" id="network">
        <div className="container">
          <div className="section-header" data-aos="fade-up">
            <h2>Professional Network</h2>
            <p style={{ color: 'var(--gray)' }}>Build meaningful connections in your industry</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button className="btn btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-user-plus"></i>
              Connect
            </button>
            <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-users"></i>
              Find Groups
            </button>
          </div>
          <div className="connections-grid">
            {connections.length > 0 ? (
              connections.map((connection, index) => (
                <div className="connection-card" key={connection.id || index} data-aos="fade-up" data-aos-delay={100 + index * 50}>
                  <div className="connection-info">
                    <div className="connection-avatar">
                      <i className="ph-fill ph-user-circle" style={{ fontSize: '1.5rem' }}></i>
                    </div>
                    <div>
                      <h4>{connection.name || connection.displayName || 'Connection'}</h4>
                      <p style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
                        {connection.title || connection.role || connection.industry || 'Professional'}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ minWidth: '100px' }}>
                    Message
                  </button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                <i className="ph ph-network" style={{ fontSize: '3rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
                <p>No connections yet. Start building your network!</p>
              </div>
            )}
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
        onClose={() => setIsApplyModalOpen(false)} 
        job={selectedJob}
      />

    </div>
  );
}
