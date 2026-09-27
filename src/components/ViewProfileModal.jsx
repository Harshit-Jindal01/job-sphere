import React, { useState, useEffect, useCallback } from 'react';
import { X, User, Envelope, Phone, Calendar, MapPin, Briefcase, FileText, Link, ChatCircleDots, Buildings, Globe, UserPlus, UserCheck } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  fetchUserProfile,
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  openDirectChat,
  subscribeToConnectionWith
} from '../services/firebaseService';

const ProfileSection = ({ title, children, icon: Icon }) => (
  <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
    <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {Icon && <Icon style={{ color: 'var(--primary)' }} />}
      {title}
    </h4>
    {children}
  </div>
);

const ProfileField = ({ label, value, icon: Icon }) => {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {Icon && <Icon style={{ fontSize: '1.2rem', color: 'var(--primary)', flexShrink: 0 }} />}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '0.95rem', color: 'var(--dark)', fontWeight: 500 }}>{value}</p>
      </div>
    </div>
  );
};

/** Skills may be stored as an array (directory) or a comma string (own profile). */
const toSkillList = (skills) => {
  if (Array.isArray(skills)) return skills.filter(Boolean).map(String);
  if (typeof skills === 'string') return skills.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const SocialLink = ({ url, icon: Icon, label }) => {
  if (!url) return null;
  let host = url;
  try {
    host = new URL(url).hostname.replace('www.', '');
  } catch {
    // A malformed URL should not crash the modal.
    host = String(url).slice(0, 30);
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
      <Icon />
      {label || host}
    </a>
  );
};

const Chip = ({ children, tone = 'primary' }) => {
  const tones = {
    primary: { background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' },
    green: { background: 'rgba(16,185,129,0.1)', color: '#059669' },
    amber: { background: 'rgba(234,179,8,0.1)', color: '#d97706' }
  };
  return (
    <span style={{ padding: '6px 12px', background: tones[tone].background, color: tones[tone].color, borderRadius: '20px', fontSize: '0.85rem' }}>
      {children}
    </span>
  );
};

const isCompany = (profile) => profile?.role === 'company';

/**
 * A single profile viewer used everywhere: from Find People, from the
 * connections list, and for the signed-in member's own profile.
 *
 * For another member it renders ONLY the public `userDirectory` projection.
 * Private fields (email, phone, date of birth, nationality, resume) belong to
 * the owner and are not readable - or shown - for anybody else.
 */
export default function ViewProfileModal({ isOpen, onClose, userId, onStartChat, onEditProfile }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // 'none' | 'sent' | 'received' | 'accepted' | 'rejected'
  const [connectionState, setConnectionState] = useState('none');
  const [pendingConnectionId, setPendingConnectionId] = useState(null);
  const [isActing, setIsActing] = useState(false);
  const { user, userData } = useAuth();
  const { showNotification } = useNotification();

  const isSelf = Boolean(user && userId === user.uid);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setConnectionState('none');
    setPendingConnectionId(null);
    try {
      const data = await fetchUserProfile(userId);
      if (!data) {
        setProfile(null);
        setError(
          isSelf
            ? 'Your profile could not be loaded.'
            : 'This member has not published a public profile yet.'
        );
        return;
      }
      setProfile(data);
    } catch (e) {
      console.error('Failed to load profile:', e);
      setProfile(null);
      setError('Failed to load this profile.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSelf]);

  useEffect(() => {
    if (!isOpen) return;
    loadProfile();
  }, [isOpen, loadProfile]);

  // Connection state. The connection document is the source of truth; the
  // previous implementation called three service functions that were never
  // imported, which is why this always threw and the buttons never appeared.
  const refreshConnectionState = useCallback(() => {
    if (!user || !userId || isSelf) return undefined;
    return subscribeToConnectionWith(user.uid, userId, (state) => {
      setConnectionState(state.status);
      setPendingConnectionId(state.connectionId);
    }, (message) => showNotification(message, 'error'));
  }, [user, userId, isSelf, showNotification]);

  useEffect(() => {
    if (!isOpen || isSelf) return undefined;
    return refreshConnectionState();
  }, [isOpen, isSelf, refreshConnectionState]);

  const handleConnect = async () => {
    if (!user || !profile || isActing) return;
    setIsActing(true);
    try {
      const requestId = await sendConnectionRequest(
        userId,
        profile.name || 'User',
        profile.photo || ''
      );
      setConnectionState('sent');
      setPendingConnectionId(requestId);
      showNotification(`Connection request sent to ${profile.name}.`, 'success');
    } catch (e) {
      console.error('Failed to send connection request:', e);
      showNotification(e?.message || 'Failed to send connection request', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleAccept = async () => {
    if (!pendingConnectionId || isActing) return;
    setIsActing(true);
    try {
      await acceptConnection(pendingConnectionId);
      setConnectionState('accepted');
      setPendingConnectionId(null);
      showNotification(`You and ${profile?.name} are now connected.`, 'success');
    } catch (e) {
      console.error('Failed to accept connection:', e);
      showNotification(e?.message || 'Failed to accept connection', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!pendingConnectionId || isActing) return;
    setIsActing(true);
    try {
      await rejectConnection(pendingConnectionId);
      setConnectionState('none');
      setPendingConnectionId(null);
      showNotification('Connection request declined.', 'info');
    } catch (e) {
      console.error('Failed to reject connection:', e);
      showNotification(e?.message || 'Failed to decline connection', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleMessage = async () => {
    if (!profile || isActing) return;
    setIsActing(true);
    try {
      // Always go through the app's own chat so one conversation per pair is
      // guaranteed, then let the host page open its existing ChatModal.
      const chatId = await openDirectChat(
        userId,
        profile.name || 'User',
        profile.photo || '',
        { name: userData?.name, photo: userData?.photo }
      );
      if (onStartChat) {
        onStartChat({
          chatId,
          otherUser: { uid: userId, name: profile.name || 'User', photo: profile.photo || '' }
        });
      } else {
        showNotification('Conversation is ready.', 'success');
      }
      onClose();
    } catch (e) {
      console.error('Failed to open chat:', e);
      showNotification(e?.message || 'Failed to open chat', 'error');
    } finally {
      setIsActing(false);
    }
  };

  if (!isOpen) return null;

  const skills = toSkillList(profile?.profile?.skills);
  const hobbies = toSkillList(profile?.profile?.hobbies);
  const certifications = toSkillList(profile?.profile?.certifications);
  const company = isCompany(profile);

  const renderActions = () => {
    if (isSelf) {
      return (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
            <UserCheck size={14} /> This is you
          </span>
          {onEditProfile && (
            <button type="button" onClick={() => { onClose(); onEditProfile(); }} className="btn btn-gradient" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus /> Edit Profile
            </button>
          )}
        </>
      );
    }

    switch (connectionState) {
      case 'accepted':
        return (
          <button type="button" onClick={handleMessage} disabled={isActing} className="btn btn-gradient" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <ChatCircleDots /> Message
          </button>
        );
      case 'sent':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(234,179,8,0.12)', color: '#b45309', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
            Request Sent
          </span>
        );
      case 'received':
        // Accept / Decline only makes sense for a request addressed to me.
        return (
          <>
            <button type="button" onClick={handleAccept} disabled={isActing} className="btn btn-gradient" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus /> Accept
            </button>
            <button type="button" onClick={handleReject} disabled={isActing} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <X /> Decline
            </button>
          </>
        );
      default:
        return (
          <button type="button" onClick={handleConnect} disabled={isActing} className="btn btn-gradient" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus /> Connect
          </button>
        );
    }
  };

  return (
    <div className="modal-wrap active" id="viewProfileModal">
      <div className="modal-box" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>{isSelf ? 'My Profile' : 'Profile'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error || !profile ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--gray)' }}>
            <User size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p>{error || 'Profile not found'}</p>
            <button type="button" onClick={loadProfile} className="btn btn-outline" style={{ marginTop: '15px' }}>Retry</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f8fafc', borderRadius: '14px', flexWrap: 'wrap' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {profile.photo ? (
                  <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={48} style={{ color: 'var(--gray)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{profile.name || 'User'}</h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--gray)', marginBottom: '8px' }}>
                  {profile.profile?.jobTitle || (company ? 'Company' : 'Job Seeker')}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {company && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Buildings size={13} /> Company
                    </span>
                  )}
                  {profile.profile?.location && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', fontSize: '0.75rem', color: 'var(--gray)', fontWeight: 600 }}>
                      <MapPin size={13} /> {profile.profile.location}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{renderActions()}</div>
            </div>

            {/* Public-only notice */}
            {!isSelf && (
              <p style={{ fontSize: '0.8rem', color: 'var(--gray)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={14} /> Only information this member has chosen to publish publicly is shown.
              </p>
            )}

            {/* About */}
            {profile.profile?.bio && (
              <ProfileSection title="About" icon={User}>
                <p style={{ fontSize: '0.95rem', color: 'var(--dark)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{profile.profile.bio}</p>
              </ProfileSection>
            )}

            {/* Basic information - private details are the owner's own only */}
            {(isSelf || profile.profile?.phone) && (
              <ProfileSection title="Basic Information" icon={User}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {isSelf && <ProfileField label="Email" value={profile.email} icon={Envelope} />}
                  <ProfileField label="Phone" value={profile.profile?.phone} icon={Phone} />
                  <ProfileField label="Date of Birth" value={profile.profile?.dob} icon={Calendar} />
                  <ProfileField label="Gender" value={profile.profile?.gender} />
                  <ProfileField label="Location" value={profile.profile?.location} icon={MapPin} />
                  <ProfileField label="Nationality" value={profile.profile?.nationality} />
                </div>
              </ProfileSection>
            )}

            {/* Professional information */}
            {(profile.profile?.jobTitle || profile.profile?.experience || profile.profile?.workType || skills.length > 0 || company) && (
              <ProfileSection title="Professional Information" icon={Briefcase}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <ProfileField label="Job Title" value={profile.profile?.jobTitle} />
                  {company && <ProfileField label="Company" value={profile.profile?.company} />}
                  <ProfileField label="Years of Experience" value={profile.profile?.experience} />
                  <ProfileField label="Expected Salary" value={profile.profile?.salary} />
                  <ProfileField label="Work Type" value={profile.profile?.workType} />
                </div>
                {skills.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '4px' }}>Skills</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {skills.map((skill) => <Chip key={skill}>{skill}</Chip>)}
                    </div>
                  </div>
                )}
                {hobbies.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '4px' }}>Hobbies</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {hobbies.map((hobby) => <Chip key={hobby} tone="green">{hobby}</Chip>)}
                    </div>
                  </div>
                )}
              </ProfileSection>
            )}

            {/* Education */}
            {(profile.profile?.degree || profile.profile?.institution || certifications.length > 0) && (
              <ProfileSection title="Education" icon={Briefcase}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <ProfileField label="Degree" value={profile.profile?.degree} />
                  <ProfileField label="Institution" value={profile.profile?.institution} />
                  <ProfileField label="Graduation Year" value={profile.profile?.gradYear} />
                  <ProfileField label="GPA / Marks" value={profile.profile?.marks} />
                </div>
                {certifications.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '4px' }}>Certifications</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {certifications.map((cert) => <Chip key={cert} tone="amber">{cert}</Chip>)}
                    </div>
                  </div>
                )}
              </ProfileSection>
            )}

            {/* Resume - owner's own document only */}
            {isSelf && profile.profile?.resumeUrl && (
              <ProfileSection title="Resume" icon={FileText}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                  <FileText size={32} style={{ color: '#059669' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: '#059669', fontSize: '0.9rem' }}>Resume</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '2px' }}>{profile.profile.resumeFileName || 'resume.pdf'}</p>
                  </div>
                  <a href={profile.profile.resumeUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: 'white', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', color: '#059669', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>View</a>
                </div>
              </ProfileSection>
            )}

            {/* Social links */}
            {(profile.profile?.linkedin || profile.profile?.github || profile.profile?.portfolio) && (
              <ProfileSection title="Social & Portfolio Links" icon={Link}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <SocialLink url={profile.profile?.linkedin} icon={Briefcase} label="LinkedIn" />
                  <SocialLink url={profile.profile?.github} icon={Briefcase} label="GitHub" />
                  <SocialLink url={profile.profile?.portfolio} icon={Globe} label="Portfolio" />
                </div>
              </ProfileSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
