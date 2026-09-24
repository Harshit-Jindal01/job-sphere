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
            <button className="filter-btn active" data-filter="all">All Jobs</button>
            <button className="filter-btn" data-filter="remote">Remote</button>
            <button className="filter-btn" data-filter="full-time">Full-time</button>
            <button className="filter-btn" data-filter="design">Design</button>
            <button className="filter-btn" data-filter="engineering">Engineering</button>
          </div>
          <div className="jobs-grid" id="jobsGrid">
            {/* Static Job Cards - matching user.html design */}
            <div className="job-card" data-aos="fade-up" data-aos-delay="100">
              <div className="company-logo" style={{ color: 'var(--accent)' }}>
                <i className="ph-fill ph-dribbble-logo"></i>
              </div>
              <div className="job-main">
                <h3>Senior Product Designer</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> Remote</span>
                  <span><i className="ph-fill ph-clock"></i> Full Time</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  Join our design team to shape the future of digital experiences for millions of users worldwide.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$120k - $140k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>

            <div className="job-card" data-aos="fade-up" data-aos-delay="150">
              <div className="company-logo" style={{ color: '#3b82f6' }}>
                <i className="ph-fill ph-code"></i>
              </div>
              <div className="job-main">
                <h3>Frontend Developer (React)</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> New York, USA</span>
                  <span><i className="ph-fill ph-clock"></i> Contract</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  Build cutting-edge web applications with modern React, TypeScript, and Next.js stack.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$90k - $110k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>

            <div className="job-card" data-aos="fade-up" data-aos-delay="200">
              <div className="company-logo" style={{ color: '#10b981' }}>
                <i className="ph-fill ph-cpu"></i>
              </div>
              <div className="job-main">
                <h3>Backend Engineer (Node.js)</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> San Francisco, USA</span>
                  <span><i className="ph-fill ph-clock"></i> Full Time</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  Design and implement scalable APIs and microservices for high-traffic applications.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$110k - $130k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>

            <div className="job-card" data-aos="fade-up" data-aos-delay="250">
              <div className="company-logo" style={{ color: '#f59e0b' }}>
                <i className="ph-fill ph-chart-line"></i>
              </div>
              <div className="job-main">
                <h3>Data Scientist</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> Remote</span>
                  <span><i className="ph-fill ph-clock"></i> Full Time</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  Leverage machine learning to solve complex business problems and drive product decisions.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$130k - $160k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>

            <div className="job-card" data-aos="fade-up" data-aos-delay="300">
              <div className="company-logo" style={{ color: '#8b5cf6' }}>
                <i className="ph-fill ph-shield-check"></i>
              </div>
              <div className="job-main">
                <h3>DevOps Engineer</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> Austin, USA</span>
                  <span><i className="ph-fill ph-clock"></i> Full Time</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  Build and maintain cloud infrastructure, CI/CD pipelines, and monitoring systems.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$100k - $125k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>

            <div className="job-card" data-aos="fade-up" data-aos-delay="350">
              <div className="company-logo" style={{ color: '#ec4899' }}>
                <i className="ph-fill ph-mobile"></i>
              </div>
              <div className="job-main">
                <h3>Mobile Developer (React Native)</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> Remote</span>
                  <span><i className="ph-fill ph-clock"></i> Contract</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  Develop cross-platform mobile applications with React Native and Expo.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$95k - $120k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>

            <div className="job-card" data-aos="fade-up" data-aos-delay="400">
              <div className="company-logo" style={{ color: '#06b6d4' }}>
                <i className="ph-fill ph-gear-six"></i>
              </div>
              <div className="job-main">
                <h3>Full Stack Engineer</h3>
                <div className="job-tags">
                  <span><i className="ph-fill ph-map-pin"></i> London, UK</span>
                  <span><i className="ph-fill ph-clock"></i> Full Time</span>
                </div>
                <p style={{ color: 'var(--gray)', marginTop: '10px', fontSize: '0.95rem' }}>
                  End-to-end feature development across the entire stack using modern technologies.
                </p>
              </div>
              <div className="job-right">
                <span className="salary-range">$105k - $135k</span>
                <button className="btn btn-gradient apply-btn">Apply Now</button>
              </div>
            </div>
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

      {/* Profile Section */}
      <section id="profile" style={{ padding: '80px 0', background: 'var(--light)' }}>
        <div className="container">
          <div className="section-header" data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2>My Profile</h2>
            <p style={{ color: 'var(--gray)' }}>Manage your professional profile</p>
          </div>

          <div className="profile-section" data-aos="fade-up" data-aos-delay="100">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray)', fontSize: '2.5rem' }}>
                <i className="ph ph-user-circle"></i>
              </div>
              <div>
                <h3 style={{ marginBottom: '4px' }}>John Doe</h3>
                <p style={{ color: 'var(--gray)', fontSize: '0.95rem' }}>Software Engineer</p>
                <p style={{ color: 'var(--gray)', fontSize: '0.95rem' }}>San Francisco, CA</p>
              </div>
            </div>

            {/* Basic Info */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-user" style={{ color: 'var(--primary)' }}></i>Basic Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Full Name</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="John Doe" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Email</label>
                  <input type="email" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="john.doe@example.com" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Phone</label>
                  <input type="tel" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="(123) 456-7890" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Location</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="San Francisco, CA" readOnly />
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-briefcase" style={{ color: 'var(--primary)' }}></i>Professional Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Current Position</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="Software Engineer" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Years of Experience</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="5 years" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Skills</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="JavaScript, React, Node.js" readOnly />
                </div>
              </div>
            </div>

            {/* Education */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-graduation-cap" style={{ color: 'var(--primary)' }}></i>Education
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Degree</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="Bachelor of Science" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Institution</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="University of XYZ" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Graduation Year</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="2020" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>GPA / Marks</label>
                  <input type="text" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="3.8 / 4.0" readOnly />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Certifications</label>
                <textarea rows="2" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem', resize: 'vertical' }} value="AWS Certified Solutions Architect, Google UX Design Certificate" readOnly />
              </div>
            </div>

            {/* Social Links */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-share-network" style={{ color: 'var(--primary)' }}></i>Social & Portfolio Links
              </h4>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>LinkedIn Profile</label>
                  <input type="url" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="https://linkedin.com/in/johndoe" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>GitHub Profile</label>
                  <input type="url" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="https://github.com/johndoe" readOnly />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Portfolio Website</label>
                  <input type="url" style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem' }} value="https://johndoe.com" readOnly />
                </div>
              </div>
            </div>

            {/* Resume Upload */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px' }}>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-file-pdf" style={{ color: 'var(--primary)' }}></i>Resume / CV
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <i className="ph-fill ph-file-pdf" style={{ fontSize: '2rem', color: '#059669' }}></i>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, color: '#059669', fontSize: '0.9rem' }}>Current Resume:</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '2px' }}>resume.pdf</p>
                </div>
                <a href="#" style={{ padding: '8px 16px', background: 'white', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', color: '#059669', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>View</a>
              </div>
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

    </div>
  );
}

