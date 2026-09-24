import React from 'react';
import Navbar from '../components/Navbar';

export default function SeekerPage() {
  return (
    <div className="seeker-page">
      <Navbar />

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
              <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><i className="ph-fill ph-codesandbox-logo" style={{ fontSize: '1.5rem' }}></i></div>
              <div><h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>Meta</h4><span style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>Frontend Engineer</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs Section */}
      <section className="jobs-section" id="jobs">
        <div className="container">
          <div className="section-header" data-aos="fade-up">
            <h2>Explore Open Roles</h2>
            <p style={{ color: 'var(--gray)' }}>Discover opportunities tailored to your skills</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button className="filter-btn active" data-filter="all">All Jobs</button>
            <button className="filter-btn" data-filter="remote">Remote</button>
            <button className="filter-btn" data-filter="full-time">Full-time</button>
            <button className="filter-btn" data-filter="design">Design</button>
            <button className="filter-btn" data-filter="engineering">Engineering</button>
          </div>
          <div className="jobs-grid" id="jobsGrid">
            <p style={{ color: 'var(--gray)', textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>Loading jobs...</p>
          </div>
        </div>
      </section>
      {/* Applications Section */}
      <section id="my-applications" style={{ padding: '80px 0', background: 'var(--light)' }}>
        <div className="container">
          <div className="section-header" data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2>My Applications</h2>
            <p style={{ color: 'var(--gray)' }}>Track the status of your submitted job applications</p>
          </div>
          <div id="applications-container" style={{ display: 'grid', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
              <i className="ph ph-folder-open" style={{ fontSize: '4rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
              <p>Sign in to view your applications</p>
            </div>
          </div>
        </div>
      </section>

      {/* Posts Section */}
      <section id="posts" style={{ padding: '80px 0', background: 'white' }}>
        <div className="container">
          <div className="section-header" data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2>Community Feed</h2>
            <p style={{ color: 'var(--gray)' }}>Share updates, insights, and connect with professionals</p>
          </div>
          <div id="posts-feed" style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <p style={{ color: 'var(--gray)', textAlign: 'center', padding: '40px' }}>No posts yet. Be the first to share!</p>
          </div>
        </div>
      </section>

    </div>
      {/* Network Section */}
      <section id="network" style={{ padding: '80px 0', background: 'var(--light)' }}>
        <div className="container">
          <div className="section-header" data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2>My Network</h2>
            <p style={{ color: 'var(--gray)' }}>Connect with professionals and grow your network</p>
          </div>
          <div style={{ maxWidth: '600px', margin: '0 auto 30px' }}>
            <div className="search-box" style={{ maxWidth: '100%' }}>
              <i className="ph ph-magnifying-glass" style={{ fontSize: '1.2rem', color: 'var(--gray)', marginLeft: '20px' }}></i>
              <input type="text" className="search-input" id="networkSearch" placeholder="Search people by name..." />
              <button className="search-btn"><i className="ph ph-arrow-right"></i></button>
            </div>
          </div>
          <div id="network-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="network-tab active" data-tab="search-results">
              <i className="ph ph-magnifying-glass"></i> Search
            </button>
            <button className="network-tab" data-tab="my-connections">
              <i className="ph ph-users"></i> Connections <span id="connections-count" className="tab-count"></span>
            </button>
            <button className="network-tab" data-tab="pending-requests">
              <i className="ph ph-clock"></i> Requests <span id="requests-count" className="tab-count"></span>
            </button>
            <button className="network-tab" data-tab="sent-requests">
              <i className="ph ph-paper-plane-tilt"></i> Sent
            </button>
          </div>
          <div id="search-results" className="network-panel">
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
              <i className="ph ph-users-three" style={{ fontSize: '4rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
              <p>Search for people to connect with</p>
            </div>
          </div>
          <div id="my-connections" className="network-panel" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
              <i className="ph ph-user-circle" style={{ fontSize: '4rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
              <p>Sign in to see your connections</p>
            </div>
          </div>
          <div id="pending-requests" className="network-panel" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
              <i className="ph ph-clock" style={{ fontSize: '4rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
              <p>Sign in to see pending requests</p>
            </div>
          </div>
          <div id="sent-requests" className="network-panel" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray)' }}>
              <i className="ph ph-paper-plane-tilt" style={{ fontSize: '4rem', marginBottom: '20px', display: 'block', opacity: '0.4' }}></i>
              <p>Sign in to see sent requests</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0f172a', color: 'white', padding: '60px 0 30px' }}>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="logo" style={{ marginBottom: '25px', color: 'white' }}><i className="ph-fill ph-hexagon"></i> Job<span>Sphere</span></div>
              <p style={{ color: '#94a3b8', lineHeight: '1.7' }}>The future of recruitment is here.</p>
            </div>
            <div className="footer-col">
              <h4>Job Seekers</h4>
              <ul>
                <li><a href="#jobs">Browse Jobs</a></li>
                <li><a href="#my-applications">My Applications</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Are you hiring?</h4>
              <ul><li><a href="/company">Switch to Company</a></li></ul>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <ul style={{ color: '#94a3b8' }}><li><i className="ph ph-envelope-simple" style={{ marginRight: '8px' }}></i>hello@jobsphere.com</li></ul>
            </div>
          </div>
          <div className="copyright">&copy; 2024 JobSphere Inc. All rights reserved.</div>
        </div>
      </footer>

  );
}

