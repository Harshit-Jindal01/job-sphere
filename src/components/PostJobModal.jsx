import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { createJob, updateJob } from '../services/firebaseService';
import {
  WORK_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  JOB_CATEGORIES,
  normalizeJob
} from '../utils/jobFilters';

const emptyForm = {
  title: '',
  company: '',
  location: '',
  workType: 'Full-time',
  workMode: 'On-site',
  category: 'Software Development',
  salaryMin: '',
  salaryMax: '',
  experienceLevel: 'Entry Level',
  skillsInput: '',
  description: '',
  requirements: ''
};

const inputStyle = {
  width: '100%',
  padding: '14px',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  fontSize: '1rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box'
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--dark)', fontSize: '0.9rem' };

const requiredMark = <span style={{ color: '#dc2626' }}>*</span>;

/**
 * Create OR edit a job with the structured fields job discovery relies on.
 * Passing `job` switches it into edit mode for the owning company.
 */
export default function PostJobModal({ isOpen, onClose, job, onSaved }) {
  const editing = Boolean(job?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(emptyForm);
  const { user, userData } = useAuth();
  const { showNotification } = useNotification();

  // Reset the form whenever the modal opens, pre-filled when editing.
  // normalizeJob() does the vocabulary mapping, so an older job is edited
  // into the current vocabulary instead of showing a blank select.
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (job) {
      const view = normalizeJob(job);
      const skills = Array.isArray(job.skills) ? job.skills : [];
      setForm({
        title: view.title || '',
        company: view.company || '',
        location: view.location || '',
        workType: WORK_TYPES.includes(view.workType) ? view.workType : 'Full-time',
        workMode: WORK_MODES.includes(view.workMode) ? view.workMode : 'On-site',
        category: JOB_CATEGORIES.includes(view.category) ? view.category : 'Other',
        salaryMin: Number.isFinite(view.salaryMin) ? String(view.salaryMin) : '',
        salaryMax: Number.isFinite(view.salaryMax) ? String(view.salaryMax) : '',
        experienceLevel: EXPERIENCE_LEVELS.includes(view.experienceLevel)
          ? view.experienceLevel
          : 'Entry Level',
        skillsInput: skills.join(', '),
        description: view.description || '',
        requirements: view.requirements || ''
      });
    } else {
      setForm({
        ...emptyForm,
        // Default the company to the signed-in company's own name.
        company: userData?.name || ''
      });
    }
  }, [isOpen, job, userData?.name]);

  const set = (name) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e?.target?.value;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const parseSkills = (raw) =>
    String(raw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20);

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Job title is required.';
    if (!form.company.trim()) next.company = 'Company name is required.';
    if (!form.location.trim()) next.location = 'Location is required.';
    if (!form.description.trim()) next.description = 'Job description is required.';

    const skills = parseSkills(form.skillsInput);
    if (skills.length === 0) {
      next.skillsInput = 'Add at least one required skill (comma separated).';
    }

    const min = form.salaryMin === '' ? null : Number(form.salaryMin);
    const max = form.salaryMax === '' ? null : Number(form.salaryMax);
    if (min === null && max === null) {
      next.salaryMin = 'Enter a minimum and/or maximum yearly salary.';
    } else {
      if (min !== null && (!Number.isFinite(min) || min < 0)) next.salaryMin = 'Enter a valid number.';
      if (max !== null && (!Number.isFinite(max) || max < 0)) next.salaryMax = 'Enter a valid number.';
      if (min !== null && max !== null && min > max) {
        next.salaryMin = 'Minimum salary cannot be higher than the maximum.';
      }
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showNotification('Please sign in to post jobs', 'error');
      return;
    }

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showNotification('Please fix the highlighted fields.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        title: form.title,
        company: form.company,
        location: form.location,
        workType: form.workType,
        workMode: form.workMode,
        category: form.category,
        salaryMin: form.salaryMin === '' ? null : Number(form.salaryMin),
        salaryMax: form.salaryMax === '' ? null : Number(form.salaryMax),
        experienceLevel: form.experienceLevel,
        skills: parseSkills(form.skillsInput),
        description: form.description,
        requirements: form.requirements
      };

      if (editing) {
        await updateJob(job.id, payload);
        showNotification('Job updated successfully!', 'success');
      } else {
        await createJob(payload, user.uid);
        showNotification('Job posted successfully!', 'success');
      }
      onSaved?.();
      onClose();
    } catch (error) {
      console.error(editing ? 'Update job error:' : 'Post job error:', error);
      const list = error?.problems;
      if (Array.isArray(list) && list.length > 0) {
        showNotification(list[0], 'error');
      } else {
        showNotification(error?.message || 'Something went wrong. Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fieldError = (name) =>
    errors[name] ? (
      <small style={{ display: 'block', marginTop: '6px', color: '#dc2626', fontWeight: 500 }}>{errors[name]}</small>
    ) : null;

  if (!isOpen) return null;

  return (
    <div className="modal-wrap active" id={editing ? 'editJobModal' : 'postJobModal'}>
      <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.5rem' }}>{editing ? 'Edit Job' : 'Post a New Job'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: 'var(--gray)', cursor: 'pointer' }}>&times;</button>
        </div>

        <p style={{ color: 'var(--gray)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Fields marked {requiredMark} are required. Structured details are what job seekers use to search and filter.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }} noValidate>
          <div>
            <label style={labelStyle} htmlFor="jobTitleInput">Job Title {requiredMark}</label>
            <input id="jobTitleInput" type="text" name="title" value={form.title} onChange={set('title')}
              placeholder="e.g. Senior Frontend Developer" style={inputStyle} />
            {fieldError('title')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle} htmlFor="jobCompanyInput">Company {requiredMark}</label>
              <input id="jobCompanyInput" type="text" name="company" value={form.company} onChange={set('company')}
                placeholder="Your company" style={inputStyle} />
              {fieldError('company')}
            </div>
            <div>
              <label style={labelStyle} htmlFor="jobLocationInput">Location {requiredMark}</label>
              <input id="jobLocationInput" type="text" name="location" value={form.location} onChange={set('location')}
                placeholder="e.g. New York, USA" style={inputStyle} />
              {fieldError('location')}
            </div>
          </div>

          {/* Work Mode and Category replace the old free-text / checkbox inputs.
              Both are chosen from the fixed application vocabularies so a posting
              can never invent a new filter option. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle} htmlFor="jobWorkModeInput">Work Mode {requiredMark}</label>
              <select id="jobWorkModeInput" name="workMode" value={form.workMode} onChange={set('workMode')} style={selectStyle}>
                {WORK_MODES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="jobCategoryInput">Category {requiredMark}</label>
              <select id="jobCategoryInput" name="category" value={form.category} onChange={set('category')} style={selectStyle}>
                {JOB_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle} htmlFor="jobWorkTypeInput">Work Type {requiredMark}</label>
              <select id="jobWorkTypeInput" name="workType" value={form.workType} onChange={set('workType')} style={selectStyle}>
                {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="jobExperienceInput">Experience Level {requiredMark}</label>
              <select id="jobExperienceInput" name="experienceLevel" value={form.experienceLevel} onChange={set('experienceLevel')} style={selectStyle}>
                {EXPERIENCE_LEVELS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="jobSalaryMinInput">Salary (yearly USD) {requiredMark}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
              <input id="jobSalaryMinInput" type="number" name="salaryMin" min="0" step="1000" value={form.salaryMin}
                onChange={set('salaryMin')} placeholder="80000" style={inputStyle} />
              <span style={{ color: 'var(--gray)' }}>to</span>
              <input type="number" name="salaryMax" min="0" step="1000" value={form.salaryMax}
                onChange={set('salaryMax')} placeholder="120000" style={inputStyle} />
            </div>
            {fieldError('salaryMin')}
            {fieldError('salaryMax')}
          </div>

          <div>
            <label style={labelStyle} htmlFor="jobSkillsInput">Required Skills {requiredMark}</label>
            <input id="jobSkillsInput" type="text" name="skills" value={form.skillsInput} onChange={set('skillsInput')}
              placeholder="e.g. React, TypeScript, CSS" style={inputStyle} />
            <small style={{ display: 'block', marginTop: '6px', color: 'var(--gray)' }}>
              Comma separated. Seekers can filter and search by these.
            </small>
            {fieldError('skillsInput')}
          </div>

          <div>
            <label style={labelStyle} htmlFor="jobDescriptionInput">Job Description {requiredMark}</label>
            <textarea id="jobDescriptionInput" name="description" value={form.description} onChange={set('description')}
              placeholder="What the role involves, who you are looking for, and what you offer..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            {fieldError('description')}
          </div>

          <div>
            <label style={labelStyle} htmlFor="jobRequirementsInput">Requirements (optional)</label>
            <textarea id="jobRequirementsInput" name="requirements" value={form.requirements} onChange={set('requirements')}
              placeholder="Must-have qualifications, certifications, nice-to-haves..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <button type="submit" className="btn btn-gradient" disabled={isLoading}
            style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isLoading ? (
              <><span className="spinner" aria-hidden="true" /> {editing ? 'Saving...' : 'Posting...'}</>
            ) : (
              <><i className="ph-fill ph-check" /> {editing ? 'Save Changes' : 'Post Job Now'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
