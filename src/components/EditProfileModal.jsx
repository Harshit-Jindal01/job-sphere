import React, { useState, useEffect } from 'react';
import { X, User, Envelope, Phone, Calendar, MapPin, Briefcase, FileText, Upload, Link } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { uploadToCloudinary, updateUserProfile, fetchCurrentUserProfile } from '../services/firebaseService';

const genderOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const workTypeOptions = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];

const ProfileSection = ({ title, children }) => (
  <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
    <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {title}
    </h4>
    {children}
  </div>
);

const InputField = ({ label, type = 'text', value, onChange, placeholder, icon: Icon, required = false, options = null }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>
      {label} {required && <span style={{ color: 'var(--primary)' }}>*</span>}
    </label>
    {options ? (
      <select value={value} onChange={onChange} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem', fontFamily: 'inherit' }}>
        <option value="">Select {label}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ) : (
      <div style={{ position: 'relative' }}>
        {Icon && <Icon style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--gray)', fontSize: '1.1rem' }} />}
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem', fontFamily: 'inherit' }} />
      </div>
    )}
  </div>
);

const ResumeUpload = ({ resumeName, onFileChange }) => (
  <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
    <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <FileText style={{ color: 'var(--primary)' }} /> Resume / CV
    </h4>
    {resumeName && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
        <FileText style={{ fontSize: '2rem', color: '#059669' }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: '#059669', fontSize: '0.9rem' }}>Current Resume:</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '2px' }}>{resumeName}</p>
        </div>
      </div>
    )}
    <label style={{ display: 'block', padding: '20px', border: '2px dashed #e2e8f0', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', background: 'white', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
      <Upload style={{ fontSize: '2rem', color: 'var(--primary)', display: 'block', marginBottom: '8px' }} />
      <span style={{ fontSize: '0.9rem', color: 'var(--dark)', fontWeight: 600 }}>Upload New Resume (PDF, DOC, DOCX)</span>
    </label>
    <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={onFileChange} />
  </div>
);

const SocialLinkInput = ({ label, value, onChange, placeholder, icon: Icon }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>{label}</label>
    <div style={{ position: 'relative' }}>
      {Icon && <Icon style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--gray)', fontSize: '1.1rem' }} />}
      <input type="url" value={value} onChange={onChange} placeholder={placeholder} style={{ padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem', fontFamily: 'inherit' }} />
    </div>
  </div>
);

export default function EditProfileModal({ isOpen, onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    location: '',
    nationality: '',
    bio: '',
    jobTitle: '',
    experience: '',
    salary: '',
    workType: '',
    skills: '',
    hobbies: '',
    degree: '',
    institution: '',
    gradYear: '',
    marks: '',
    certifications: '',
    linkedin: '',
    github: '',
    portfolio: '',
    photoUrl: '',
    resumeUrl: '',
    resumeFileName: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen && user) {
      loadProfileData();
    }
  }, [isOpen, user]);

  const loadProfileData = async () => {
    try {
      const profile = await fetchCurrentUserProfile();
      if (profile) {
        setProfileData({
          fullName: profile.name || '',
          email: profile.email || '',
          phone: profile.profile?.phone || '',
          dob: profile.profile?.dob || '',
          gender: profile.profile?.gender || '',
          location: profile.profile?.location || '',
          nationality: profile.profile?.nationality || '',
          bio: profile.profile?.bio || '',
          jobTitle: profile.profile?.jobTitle || '',
          experience: profile.profile?.experience || '',
          salary: profile.profile?.salary || '',
          workType: profile.profile?.workType || '',
          skills: profile.profile?.skills || '',
          hobbies: profile.profile?.hobbies || '',
          degree: profile.profile?.degree || '',
          institution: profile.profile?.institution || '',
          gradYear: profile.profile?.gradYear || '',
          marks: profile.profile?.marks || '',
          certifications: profile.profile?.certifications || '',
          linkedin: profile.profile?.linkedin || '',
          github: profile.profile?.github || '',
          portfolio: profile.profile?.portfolio || '',
          photoUrl: profile.photo || '',
          resumeUrl: profile.profile?.resumeUrl || '',
          resumeFileName: profile.profile?.resumeFileName || ''
        });
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
      showNotification('Failed to load profile data', 'error');
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.match('image.*')) {
        showNotification('Please upload an image file', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Image size must be less than 5MB', 'error');
        return;
      }
      setPhotoFile(file);
      try {
        const result = await uploadToCloudinary(file, 'jobsphere/profile-photos');
        setProfileData(prev => ({ ...prev, photoUrl: result.url }));
      } catch (e) {
        console.error('Photo upload failed:', e);
        showNotification('Failed to upload photo', 'error');
      }
    }
  };

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.match(/\.(pdf|doc|docx)$/i)) {
        showNotification('Please upload a PDF, DOC, or DOCX file', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showNotification('File size must be less than 5MB', 'error');
        return;
      }
      setResumeFile(file);
      setProfileData(prev => ({ ...prev, resumeFileName: file.name }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      let updatedData = { ...profileData };

      // Upload new resume if selected
      if (resumeFile) {
        const result = await uploadToCloudinary(resumeFile, 'jobsphere/resumes');
        updatedData.resumeUrl = result.url;
        updatedData.resumeFileName = resumeFile.name;
      }

      await updateUserProfile(user.uid, updatedData);
      showNotification('Profile updated successfully!', 'success');
      onClose();
    } catch (e) {
      console.error('Update error:', e);
      showNotification('Failed to update profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id="editProfileModal">
      <div className="modal-box" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>Edit Profile</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          {/* Profile Photo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
              {profileData.photoUrl ? (
                <img src={profileData.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User style={{ fontSize: '4rem', color: 'var(--gray)' }} />
              )}
              <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--primary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Upload style={{ color: 'white' }} />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </label>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray)' }}>Click to upload new photo</p>
          </div>

          {/* Basic Information */}
          <ProfileSection title={<><User style={{ color: 'var(--primary)' }} /> Basic Information</>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InputField label="Full Name" value={profileData.fullName} onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))} placeholder="John Doe" icon={User} required />
              <InputField label="Email" type="email" value={profileData.email} onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))} placeholder="john@example.com" icon={Envelope} required />
              <InputField label="Phone" type="tel" value={profileData.phone} onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+1 234 567 890" icon={Phone} />
              <InputField label="Date of Birth" type="date" value={profileData.dob} onChange={(e) => setProfileData(prev => ({ ...prev, dob: e.target.value }))} icon={Calendar} />
              <InputField label="Gender" value={profileData.gender} onChange={(e) => setProfileData(prev => ({ ...prev, gender: e.target.value }))} options={genderOptions} />
              <InputField label="Location" value={profileData.location} onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))} placeholder="City, Country" icon={MapPin} />
              <InputField label="Nationality" value={profileData.nationality} onChange={(e) => setProfileData(prev => ({ ...prev, nationality: e.target.value }))} placeholder="Nationality" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Bio</label>
              <textarea value={profileData.bio} onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tell us about yourself..." rows={3} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </ProfileSection>

          {/* Professional Information */}
          <ProfileSection title={<><Briefcase style={{ color: 'var(--primary)' }} /> Professional Information</>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InputField label="Job Title" value={profileData.jobTitle} onChange={(e) => setProfileData(prev => ({ ...prev, jobTitle: e.target.value }))} placeholder="Software Engineer" icon={Briefcase} />
              <InputField label="Years of Experience" type="number" value={profileData.experience} onChange={(e) => setProfileData(prev => ({ ...prev, experience: e.target.value }))} placeholder="5" />
              <InputField label="Expected Salary" value={profileData.salary} onChange={(e) => setProfileData(prev => ({ ...prev, salary: e.target.value }))} placeholder="$80,000" />
              <InputField label="Work Type" value={profileData.workType} onChange={(e) => setProfileData(prev => ({ ...prev, workType: e.target.value }))} options={workTypeOptions} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InputField label="Skills (comma separated)" value={profileData.skills} onChange={(e) => setProfileData(prev => ({ ...prev, skills: e.target.value }))} placeholder="JavaScript, React, Node.js" />
              <InputField label="Hobbies (comma separated)" value={profileData.hobbies} onChange={(e) => setProfileData(prev => ({ ...prev, hobbies: e.target.value }))} placeholder="Photography, Reading, Traveling" />
            </div>
          </ProfileSection>

          {/* Education */}
          <ProfileSection title={<><i className="ph ph-graduation-cap" style={{ color: 'var(--primary)' }} /> Education</>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InputField label="Degree" value={profileData.degree} onChange={(e) => setProfileData(prev => ({ ...prev, degree: e.target.value }))} placeholder="Bachelor of Science" />
              <InputField label="Institution" value={profileData.institution} onChange={(e) => setProfileData(prev => ({ ...prev, institution: e.target.value }))} placeholder="University of XYZ" />
              <InputField label="Graduation Year" type="number" value={profileData.gradYear} onChange={(e) => setProfileData(prev => ({ ...prev, gradYear: e.target.value }))} placeholder="2020" />
              <InputField label="GPA / Marks" value={profileData.marks} onChange={(e) => setProfileData(prev => ({ ...prev, marks: e.target.value }))} placeholder="3.8 / 4.0 or 85%" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--gray)', fontSize: '0.85rem', fontWeight: '600' }}>Certifications (optional)</label>
              <textarea value={profileData.certifications} onChange={(e) => setProfileData(prev => ({ ...prev, certifications: e.target.value }))} placeholder="AWS Certified Solutions Architect, Google UX Design Certificate" rows={2} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </ProfileSection>

          {/* Resume Upload */}
          <ResumeUpload resumeName={profileData.resumeFileName} onFileChange={handleResumeChange} />

          {/* Social Links */}
          <ProfileSection title={<><Link style={{ color: 'var(--primary)' }} /> Social & Portfolio Links</>}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <SocialLinkInput label="LinkedIn Profile" value={profileData.linkedin} onChange={(e) => setProfileData(prev => ({ ...prev, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/yourprofile" icon={Link} />
              <SocialLinkInput label="GitHub Profile" value={profileData.github} onChange={(e) => setProfileData(prev => ({ ...prev, github: e.target.value }))} placeholder="https://github.com/yourusername" icon={Link} />
              <SocialLinkInput label="Portfolio Website" value={profileData.portfolio} onChange={(e) => setProfileData(prev => ({ ...prev, portfolio: e.target.value }))} placeholder="https://yourportfolio.com" icon={Link} />
            </div>
          </ProfileSection>

          <button type="submit" className="btn btn-gradient" disabled={isLoading} style={{ width: '100%', padding: '18px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isLoading ? (
              <>
                <span style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : (
              <>
                <i className="ph ph-floppy-disk" /> Save Profile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
