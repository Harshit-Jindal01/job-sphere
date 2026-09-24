import React, { useState, useEffect } from 'react';
import { X, User, Envelope, Phone, Calendar, MapPin, Briefcase, FileText, Link, ChatCircleDots } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { fetchUserProfile, sendConnectionRequest, acceptConnection, openDirectChat } from '../services/firebaseService';

const ProfileSection = ({ title, children, icon: Icon }) => (
  <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
    <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {Icon && <Icon style={{ color: 'var(--primary)' }} />}
      {title}
    </h4>
    {children}
  </div>
);

const ProfileField = ({ label, value, icon: Icon }) => (
  <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
    {Icon && <Icon style={{ fontSize: '1.2rem', color: 'var(--primary)', flexShrink: 0 }} />}
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '0.95rem', color: 'var(--dark)', fontWeight: 500 }}>{value || 'Not specified'}</p>
    </div>
  </div>
);

const SocialLink = ({ url, icon: Icon }) => (
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
      <Icon />
      {new URL(url).hostname.replace('www.', '')}
    </a>
  ) : null
);

const StatusBadge = ({ status }) => {
  const statusStyles = {
    pending: { bg: 'rgba(251,191,36,0.15)', color: '#d97706', label: 'Pending' },
    accepted: { bg: 'rgba(16,185,129,0.15)', color: '#059669', label: 'Connected' },
    rejected: { bg: 'rgba(239,68,68,0.15)', color: '#dc2626', label: 'Rejected' }
  };

  const style = statusStyles[status] || statusStyles.pending;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', background: style.bg, color: style.color, borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
      {style.label}
    </span>
  );
};

export default function ViewProfileModal({ isOpen, onClose, userId }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionId, setConnectionId] = useState(null);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserProfile(userId);
      setProfile(data);
      checkConnectionStatus(data);
    } catch (e) {
      console.error('Failed to load profile:', e);
      showNotification('Failed to load profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnectionStatus = async (profileData) => {
    if (!user || !profileData) return;

    try {
      // Check if current user sent a request
      const sentRequests = await fetchSentRequests(user.uid);
      const sentRequest = sentRequests.find(req => req.to === userId);

      // Check if current user received a request
      const receivedRequests = await fetchReceivedRequests(user.uid);
      const receivedRequest = receivedRequests.find(req => req.from === userId);

      // Check if already connected
      const connections = await fetchConnections(user.uid);
      const isConnected = connections.some(conn =>
        (conn.from === user.uid && conn.to === userId) ||
        (conn.to === user.uid && conn.from === userId)
      );

      if (isConnected) {
        setConnectionStatus('accepted');
      } else if (sentRequest) {
        setConnectionStatus('pending');
        setConnectionId(sentRequest.id);
      } else if (receivedRequest) {
        setConnectionStatus('pending');
        setConnectionId(receivedRequest.id);
      } else {
        setConnectionStatus(null);
      }
    } catch (e) {
      console.error('Failed to check connection status:', e);
    }
  };

  const handleConnect = async () => {
    if (!user || !profile) return;

    try {
      const requestId = await sendConnectionRequest(
        userId,
        profile.name || 'User',
        profile.photo || ''
      );
      setConnectionStatus('pending');
      setConnectionId(requestId);
      showNotification('Connection request sent!', 'success');
    } catch (e) {
      console.error('Failed to send connection request:', e);
      showNotification(e.message || 'Failed to send connection request', 'error');
    }
  };

  const handleAccept = async () => {
    if (!connectionId) return;

    try {
      await acceptConnection(connectionId);
      setConnectionStatus('accepted');
      showNotification('Connection accepted!', 'success');
    } catch (e) {
      console.error('Failed to accept connection:', e);
      showNotification('Failed to accept connection', 'error');
    }
  };

  const handleMessage = async () => {
    if (!profile) return;

    try {
      const chatId = await openDirectChat(
        userId,
        profile.name || 'User',
        profile.photo || ''
      );
      onClose();
      // In a real app, you would open the chat modal here
      showNotification('Chat opened!', 'success');
    } catch (e) {
      console.error('Failed to open chat:', e);
      showNotification('Failed to open chat', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="viewProfileModal">
      <div className="modal-box" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Profile</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : profile ? (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f8fafc', borderRadius: '14px' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {profile.photo ? (
                  <img src={profile.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User style={{ fontSize: '3rem', color: 'var(--gray)' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{profile.name || 'User'}</h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--gray)', marginBottom: '8px' }}>{profile.profile?.jobTitle || 'Job Seeker'}</p>
                {user && user.uid !== userId && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {connectionStatus === 'accepted' ? (
                      <button onClick={handleMessage} className="btn btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ChatCircleDots /> Message
                      </button>
                    ) : connectionStatus === 'pending' ? (
                      <StatusBadge status={connectionStatus} />
                    ) : (
                      <button onClick={handleConnect} className="btn btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User /> Connect
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Basic Information */}
            <ProfileSection title="Basic Information" icon={User}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <ProfileField label="Email" value={profile.email} icon={Envelope} />
                <ProfileField label="Phone" value={profile.profile?.phone} icon={Phone} />
                <ProfileField label="Date of Birth" value={profile.profile?.dob} icon={Calendar} />
                <ProfileField label="Gender" value={profile.profile?.gender} />
                <ProfileField label="Location" value={profile.profile?.location} icon={MapPin} />
                <ProfileField label="Nationality" value={profile.profile?.nationality} />
              </div>
              {profile.profile?.bio && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '0.95rem', color: 'var(--dark)', lineHeight: '1.6' }}>{profile.profile.bio}</p>
                </div>
              )}
            </ProfileSection>

            {/* Professional Information */}
            <ProfileSection title="Professional Information" icon={Briefcase}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <ProfileField label="Job Title" value={profile.profile?.jobTitle} />
                <ProfileField label="Years of Experience" value={profile.profile?.experience} />
                <ProfileField label="Expected Salary" value={profile.profile?.salary} />
                <ProfileField label="Work Type" value={profile.profile?.workType} />
              </div>
              {profile.profile?.skills && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '4px' }}>Skills</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profile.profile.skills.split(',').map((skill, i) => (
                      <span key={i} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.85rem' }}>{skill.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.profile?.hobbies && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '4px' }}>Hobbies</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profile.profile.hobbies.split(',').map((hobby, i) => (
                      <span key={i} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', color: '#059669', borderRadius: '20px', fontSize: '0.85rem' }}>{hobby.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </ProfileSection>

            {/* Education */}
            <ProfileSection title="Education" icon={() => <i className="ph ph-graduation-cap" style={{ color: 'var(--primary)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <ProfileField label="Degree" value={profile.profile?.degree} />
                <ProfileField label="Institution" value={profile.profile?.institution} />
                <ProfileField label="Graduation Year" value={profile.profile?.gradYear} />
                <ProfileField label="GPA / Marks" value={profile.profile?.marks} />
              </div>
              {profile.profile?.certifications && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '4px' }}>Certifications</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profile.profile.certifications.split(',').map((cert, i) => (
                      <span key={i} style={{ padding: '6px 12px', background: 'rgba(234,179,8,0.1)', color: '#d97706', borderRadius: '20px', fontSize: '0.85rem' }}>{cert.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </ProfileSection>

            {/* Resume */}
            {profile.profile?.resumeUrl && (
              <ProfileSection title="Resume" icon={FileText}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                  <FileText style={{ fontSize: '2rem', color: '#059669' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: '#059669', fontSize: '0.9rem' }}>Resume</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '2px' }}>{profile.profile.resumeFileName || 'resume.pdf'}</p>
                  </div>
                  <a href={profile.profile.resumeUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: 'white', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', color: '#059669', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>View</a>
                </div>
              </ProfileSection>
            )}

            {/* Social Links */}
            {(profile.profile?.linkedin || profile.profile?.github || profile.profile?.portfolio) && (
              <ProfileSection title="Social & Portfolio Links" icon={Link}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <SocialLink url={profile.profile?.linkedin} icon={() => <i className="ph-fill ph-linkedin-logo" />} />
                  <SocialLink url={profile.profile?.github} icon={() => <i className="ph-fill ph-github-logo" />} />
                  <SocialLink url={profile.profile?.portfolio} icon={() => <i className="ph ph-globe" />} />
                </div>
              </ProfileSection>
            )}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--gray)', padding: '40px' }}>Profile not found</p>
        )}
      </div>
    </div>
  );
}
