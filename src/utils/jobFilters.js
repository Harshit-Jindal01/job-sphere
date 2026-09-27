/**
 * Job discovery helpers.
 *
 * Pure functions (no Firebase) so the search / filter behaviour can be unit
 * tested. Everything here is tolerant of older job documents that were created
 * before the structured fields existed - those simply do not match the filters
 * that need the missing field instead of breaking the app.
 *
 * DESIGN RULE: the filter vocabularies below are DEFINED BY THE APPLICATION.
 * Filter menus always offer the full list regardless of which jobs happen to
 * exist right now, so a single newly posted job can never reshape the filters
 * for every other seeker. Job documents store values taken from these exact
 * lists, and anything unrecognised falls back rather than inventing a category.
 */

// ---- controlled vocabularies (fixed by the application) --------------------
export const WORK_TYPES = [
  'Full-time',
  'Part-time',
  'Internship',
  'Contract',
  'Freelance'
];

export const EXPERIENCE_LEVELS = [
  'Entry Level',
  '0-2 years',
  '2-5 years',
  '5-8 years',
  '8+ years'
];

export const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];

export const JOB_CATEGORIES = [
  'Software Development',
  'Data Science',
  'Data Analytics',
  'Design',
  'Marketing',
  'Finance',
  'Human Resources',
  'Sales',
  'Operations',
  'Other'
];

/**
 * Older postings used different wording (and the original legacy app stored
 * "Full Time" / "Part Time"). Mapping those onto the current vocabulary keeps
 * already-published jobs filterable instead of silently dropping out of the
 * results. Anything not listed here simply does not match that filter.
 */
const WORK_TYPE_ALIASES = {
  'full time': 'Full-time',
  'fulltime': 'Full-time',
  'part time': 'Part-time',
  'parttime': 'Part-time',
  intern: 'Internship',
  internship: 'Internship',
  contract: 'Contract',
  freelance: 'Freelance'
};

const EXPERIENCE_ALIASES = {
  'entry level': 'Entry Level',
  entry: 'Entry Level',
  fresher: 'Entry Level',
  '0 - 2 years': '0-2 years',
  '2 - 5 years': '2-5 years',
  '5 - 8 years': '5-8 years',
  '8 + years': '8+ years',
  // The previous vocabulary, mapped onto the years-based scale.
  'mid level': '2-5 years',
  'senior level': '5-8 years',
  'lead / manager': '8+ years'
};

const WORK_MODE_ALIASES = {
  remote: 'Remote',
  'work from home': 'Remote',
  wfh: 'Remote',
  hybrid: 'Hybrid',
  'on-site': 'On-site',
  onsite: 'On-site',
  'on site': 'On-site',
  'in office': 'On-site'
};

/** Case-insensitive lookup into a controlled vocabulary. */
const matchVocabulary = (value, list, aliases = {}) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const exact = list.find((entry) => entry.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const alias = aliases[raw.toLowerCase()];
  if (alias && list.includes(alias)) return alias;
  return '';
};

/** Salary bands used by the filter, expressed as a minimum yearly USD figure. */
export const SALARY_BANDS = [
  { value: '', label: 'Any salary' },
  { value: '40000', label: '$40k+' },
  { value: '60000', label: '$60k+' },
  { value: '80000', label: '$80k+' },
  { value: '100000', label: '$100k+' },
  { value: '120000', label: '$120k+' },
  { value: '150000', label: '$150k+' },
  { value: '200000', label: '$200k+' }
];

const asText = (value) => (typeof value === 'string' ? value : '');
const asList = (value) => (Array.isArray(value) ? value.filter(v => typeof v === 'string') : []);

/**
 * The structured fields a job carries, with safe fallbacks for older documents.
 * `type` and `salary` already existed; the rest are new.
 *
 * Every categorised field is snapped to the application vocabulary. A value
 * that is not in the vocabulary stays empty instead of becoming a brand new
 * filter option, which is what previously let one job reshape the menus.
 */
export const normalizeJob = (job) => {
  const source = job || {};
  const skills = asList(source.skills);
  const location = asText(source.location);

  // Work mode: the stored field wins; otherwise infer Remote from the location
  // text, because older postings recorded "Remote" as the location.
  const workMode =
    matchVocabulary(source.workMode, WORK_MODES, WORK_MODE_ALIASES) ||
    (/remote/i.test(location) ? 'Remote' : '');

  return {
    ...source,
    workType: matchVocabulary(source.workType || source.type, WORK_TYPES, WORK_TYPE_ALIASES),
    workMode,
    // `remote` stays for compatibility with the first version of this schema.
    remote: source.remote === true || workMode === 'Remote',
    category: matchVocabulary(source.category, JOB_CATEGORIES),
    salary: asText(source.salary),
    salaryMin: Number.isFinite(source.salaryMin) ? source.salaryMin : null,
    salaryMax: Number.isFinite(source.salaryMax) ? source.salaryMax : null,
    experienceLevel: matchVocabulary(
      source.experienceLevel,
      EXPERIENCE_LEVELS,
      EXPERIENCE_ALIASES
    ),
    skills,
    requirements: asText(source.requirements),
    description: asText(source.description)
  };
};

/** Everything a free-text search should look at, lower-cased. */
export const jobSearchHaystack = (job) => {
  const j = normalizeJob(job);
  return [
    j.title,
    j.company,
    j.location,
    j.workType,
    j.workMode,
    j.category,
    j.experienceLevel,
    j.description,
    j.requirements,
    // The display salary string is searchable too, so an old free-text salary
    // such as "$80k - $95k" can still be found by typing "80k".
    j.salary,
    ...(j.skills || [])
  ]
    .filter(Boolean)
    .join('   ')
    .toLowerCase();
};

/**
 * Numeric minimum yearly salary.
 * New jobs store `salaryMin`. Older jobs only have the free-text `salary`
 * string, so it is parsed as a best effort (handles "$100k - $130k", "80,000",
 * "$120k", etc.). Returns null when nothing sensible can be read.
 */
export const getSalaryFloor = (job) => {
  const j = normalizeJob(job);
  if (j.salaryMin !== null) return j.salaryMin;
  const text = j.salary;
  if (!text) return null;

  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;

  const numbers = matches
    .map(m => Number(m.replace(/,/g, '')))
    .filter(n => Number.isFinite(n) && n > 0);
  if (numbers.length === 0) return null;

  // "100k - 130k" -> 100000 ; "80,000 - 90,000" -> 80000
  const looksLikeThousands = /k/i.test(text) || numbers.some(n => n < 1000);
  const lowest = Math.min(...numbers);
  return looksLikeThousands ? lowest * 1000 : lowest;
};

/** Case-insensitive, partial, multi-word (all terms must match) search. */
export const jobMatchesSearch = (job, term) => {
  const query = asText(term).trim().toLowerCase();
  if (!query) return true;
  const haystack = jobSearchHaystack(job);
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every(word => haystack.includes(word));
};

/**
 * All active filters must match (AND logic). Every filter is opt-in, and a
 * filter is only satisfied by a job that actually stores that structured field.
 * Category and work mode are matched against the stored value - never guessed
 * from the job title.
 */
export const jobMatchesFilters = (job, filters = {}) => {
  const j = normalizeJob(job);

  if (filters.workType && j.workType !== filters.workType) return false;
  if (filters.experienceLevel && j.experienceLevel !== filters.experienceLevel) return false;
  if (filters.workMode && j.workMode !== filters.workMode) return false;
  if (filters.category && j.category !== filters.category) return false;

  if (filters.location) {
    const needle = filters.location.trim().toLowerCase();
    if (!needle) {
      // nothing to do
    } else if (!asText(j.location).toLowerCase().includes(needle)) {
      return false;
    }
  }

  if (filters.skill) {
    const needle = filters.skill.trim().toLowerCase();
    const hasSkill = j.skills.some(s => s.toLowerCase() === needle);
    if (!hasSkill) return false;
  }

  if (filters.minSalary) {
    const floor = getSalaryFloor(j);
    // A job with no readable salary cannot satisfy a salary filter.
    if (floor === null || floor < Number(filters.minSalary)) return false;
  }

  return true;
};

/**
 * Filter menu options.
 *
 * These come from the application-defined vocabularies, NOT from the jobs that
 * happen to be loaded. `locations` and `skills` are the only data-derived
 * lists, because they are genuinely open-ended (a city or a technology cannot
 * be enumerated up front) - and they are shown alongside the fixed filters
 * rather than replacing them.
 */
export const collectJobFacets = (jobs = []) => {
  const list = jobs.map(normalizeJob);
  const uniqSorted = (values) =>
    [...new Set(values.filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));

  return {
    // Fixed by the application - always the full list.
    workTypes: [...WORK_TYPES],
    experienceLevels: [...EXPERIENCE_LEVELS],
    workModes: [...WORK_MODES],
    categories: [...JOB_CATEGORIES],
    // Genuinely open-ended, so derived from the loaded jobs.
    locations: uniqSorted(
      list
        .map(j => j.location)
        .filter(loc => loc && !/remote/i.test(loc))
    ),
    skills: uniqSorted(
      list.flatMap(j => j.skills).filter(s => s && s.length <= 40)
    )
  };
};

export const EMPTY_FILTERS = {
  workType: '',
  experienceLevel: '',
  workMode: '',
  category: '',
  location: '',
  skill: '',
  minSalary: ''
};

export const hasActiveFilters = (filters = {}) =>
  Boolean(
    (filters.workType && filters.workType !== '') ||
      (filters.experienceLevel && filters.experienceLevel !== '') ||
      (filters.workMode && filters.workMode !== '') ||
      (filters.category && filters.category !== '') ||
      (filters.location && filters.location !== '') ||
      (filters.skill && filters.skill !== '') ||
      (filters.minSalary && filters.minSalary !== '')
  );

/** Normalise a raw filter object coming from <select> elements. */
export const normalizeFilters = (filters = {}) => ({
  workType: asText(filters.workType),
  experienceLevel: asText(filters.experienceLevel),
  workMode: asText(filters.workMode),
  category: asText(filters.category),
  location: asText(filters.location),
  skill: asText(filters.skill),
  minSalary: filters.minSalary === '' || filters.minSalary == null ? '' : String(filters.minSalary)
});

/** The single entry point used by the page. */
export const filterJobs = (jobs, { search = '', filters = {} } = {}) => {
  const active = normalizeFilters(filters);
  return (jobs || [])
    .map(normalizeJob)
    .filter(job => jobMatchesSearch(job, search))
    .filter(job => jobMatchesFilters(job, active));
};

// ---- application status ----------------------------------------------------
// These are the values the application pipeline actually writes:
// applyToJob -> 'pending', updateApplicationStatus -> 'accepted' | 'rejected'
export const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected'];

export const APPLICATION_STATUS_META = {
  pending: { label: 'Pending', className: 'pending' },
  accepted: { label: 'Accepted', className: 'accepted' },
  rejected: { label: 'Rejected', className: 'rejected' }
};

export const getApplicationStatusMeta = (status) =>
  APPLICATION_STATUS_META[status] || APPLICATION_STATUS_META.pending;

/**
 * Build a jobId -> application map so a job card can show its status without
 * opening job details. When a seeker applied more than once, the most
 * recently applied entry wins.
 */
export const indexApplicationsByJob = (applications = []) => {
  const map = {};
  const timeOf = (app) => {
    const t = app?.appliedAt;
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
    const parsed = new Date(t).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  for (const app of applications || []) {
    if (!app || !app.jobId) continue;
    const existing = map[app.jobId];
    if (!existing || timeOf(app) >= timeOf(existing)) {
      map[app.jobId] = app;
    }
  }
  return map;
};
