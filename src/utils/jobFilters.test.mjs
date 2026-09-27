/**
 * Unit tests for the job discovery helpers (search + filters + status).
 * Pure functions, no Firebase and no network.
 *
 * The helper module is ESM, so the source is loaded through a vm context that
 * strips `export` and re-exposes the bindings. That keeps ONE implementation
 * under test rather than a copy.
 *
 *   node src/utils/jobFilters.test.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'jobFilters.js'), 'utf8');

const exportNames = [...src.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);
if (exportNames.length === 0) throw new Error('no exports found in jobFilters.js');

const context = vm.createContext({});
vm.runInContext(
  `${src.replace(/export\s+(const|function)/g, '$1')}\n;globalThis.__ns = { ${exportNames.join(', ')} };`,
  context
);
const M = vm.runInContext('__ns', context);

const {
  normalizeJob, jobMatchesSearch, jobMatchesFilters, filterJobs, getSalaryFloor,
  collectJobFacets, hasActiveFilters, normalizeFilters, indexApplicationsByJob,
  getApplicationStatusMeta, EMPTY_FILTERS,
  WORK_TYPES, EXPERIENCE_LEVELS, WORK_MODES, JOB_CATEGORIES
} = M;

let pass = 0, fail = 0;
const eq = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const good = a === e;
  good ? pass++ : fail++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${label}${good ? '' : `\n        got=${a}\n       want=${e}`}`);
};
const ok = (label, cond) => eq(label, Boolean(cond), true);

// ---- a realistic, fully structured job ---------------------------------------
const reactJob = normalizeJob({
  id: 'j1', title: 'Senior Frontend Developer', company: 'Acme Labs',
  location: 'New York, USA', workType: 'Full-time', type: 'Full-time',
  workMode: 'Hybrid', category: 'Software Development',
  remote: false, salary: '$100k - $130k', salaryMin: 100000, salaryMax: 130000,
  experienceLevel: '5-8 years', skills: ['React', 'TypeScript', 'CSS'],
  description: 'Build the design system and the customer dashboard.',
  requirements: '5+ years with React', postedBy: 'co1'
});

// ---- an OLD job document with none of the structured fields ------------------
const legacyJob = normalizeJob({
  id: 'j0', title: 'ai developer', company: 'Old Co', location: 'Remote / India',
  salary: '$80k - $95k', description: 'Work on ai and ml systems.',
  postedBy: 'co1', postedAt: { seconds: 1700000000 }
});

console.log('\n===== JOB DISCOVERY UNIT TESTS =====\n');
console.log('A. Predefined vocabularies are fixed by the application');
eq('work types are the predefined five', WORK_TYPES, ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance']);
eq('experience levels are the predefined five', EXPERIENCE_LEVELS, ['Entry Level', '0-2 years', '2-5 years', '5-8 years', '8+ years']);
eq('work modes are the predefined three', WORK_MODES, ['Remote', 'Hybrid', 'On-site']);
eq('categories are the predefined ten', JOB_CATEGORIES, ['Software Development', 'Data Science', 'Data Analytics', 'Design', 'Marketing', 'Finance', 'Human Resources', 'Sales', 'Operations', 'Other']);

console.log('\nB. Filter options do NOT depend on the jobs that exist');
const oneJob = collectJobFacets([reactJob]);
eq('one job still yields all 5 work types', oneJob.workTypes, WORK_TYPES);
eq('one job still yields all 5 experience levels', oneJob.experienceLevels, EXPERIENCE_LEVELS);
eq('one job still yields all 3 work modes', oneJob.workModes, WORK_MODES);
eq('one job still yields all 10 categories', oneJob.categories, JOB_CATEGORIES);
const noJobs = collectJobFacets([]);
eq('with ZERO jobs the fixed filters are still full', [noJobs.workTypes.length, noJobs.categories.length, noJobs.workModes.length, noJobs.experienceLevels.length], [5, 10, 3, 5]);
eq('with zero jobs the open-ended lists are simply empty', [noJobs.locations, noJobs.skills], [[], []]);
// The bug being guarded against: a job created by a company reshaping the menus.
const weirdJob = normalizeJob({ id: 'j2', title: 'x', workType: 'Contract', experienceLevel: '8+ years', workMode: 'On-site', category: 'Finance' });
const afterWeird = collectJobFacets([reactJob, weirdJob]);
eq('a second job does not shrink or reorder the work type list', afterWeird.workTypes, WORK_TYPES);
eq('a second job does not add a new category', afterWeird.categories, JOB_CATEGORIES);
eq('a new job never invents a category outside the vocabulary', weirdJob.category, 'Finance');
eq('an out-of-vocabulary category is dropped, not invented', normalizeJob({ category: 'Astrology' }).category, '');
eq('an out-of-vocabulary work type is dropped, not invented', normalizeJob({ workType: 'Cosmic Intern' }).workType, '');

console.log('\nC. Legacy job compatibility');
eq('legacy job: missing fields become safe empties', [legacyJob.workType, legacyJob.experienceLevel, legacyJob.category, legacyJob.skills], ['', '', '', []]);
eq('legacy job does not lose any existing data', [legacyJob.title, legacyJob.company, legacyJob.salary], ['ai developer', 'Old Co', '$80k - $95k']);
eq('legacy "Remote" location infers the Remote work mode', legacyJob.workMode, 'Remote');
eq('legacy `type` field still maps to workType', normalizeJob({ type: 'Part Time' }).workType, 'Part-time');
eq('legacy "Senior level" maps onto the years scale', normalizeJob({ experienceLevel: 'Senior level' }).experienceLevel, '5-8 years');
eq('legacy "Mid level" maps onto the years scale', normalizeJob({ experienceLevel: 'Mid level' }).experienceLevel, '2-5 years');
eq('legacy "Lead / Manager" maps onto the years scale', normalizeJob({ experienceLevel: 'Lead / Manager' }).experienceLevel, '8+ years');
eq('legacy "entry level" (lowercase) maps onto Entry Level', normalizeJob({ experienceLevel: 'entry level' }).experienceLevel, 'Entry Level');
eq('a job with no category cannot match a category filter', jobMatchesFilters(normalizeJob({ title: 'x' }), { category: 'Other' }), false);

console.log('\nD. Salary parsing (numeric, so it can actually be filtered)');
eq('structured salaryMin wins', getSalaryFloor(reactJob), 100000);
eq('legacy "$80k - $95k" parses to 80000', getSalaryFloor(legacyJob), 80000);
eq('legacy "80,000 - 90,000" parses to 80000', getSalaryFloor(normalizeJob({ salary: '80,000 - 90,000' })), 80000);
eq('no salary -> null', getSalaryFloor(normalizeJob({})), null);

console.log('\nE. Search (case-insensitive, partial, multi-field)');
ok('empty search matches everything', jobMatchesSearch(reactJob, ''));
ok('matches title, case-insensitive', jobMatchesSearch(reactJob, 'FRONTEND'));
ok('partial match inside a word', jobMatchesSearch(reactJob, 'develop'));
ok('matches a skill', jobMatchesSearch(reactJob, 'typescript'));
ok('matches company', jobMatchesSearch(reactJob, 'acme'));
ok('matches location', jobMatchesSearch(reactJob, 'new york'));
ok('matches description', jobMatchesSearch(reactJob, 'design system'));
ok('matches the category', jobMatchesSearch(reactJob, 'software development'));
ok('matches the work mode', jobMatchesSearch(reactJob, 'hybrid'));
ok('does NOT match an absent word', !jobMatchesSearch(reactJob, 'kubernetes'));
ok('multi-word search requires ALL words', !jobMatchesSearch(reactJob, 'react kubernetes'));
ok('multi-word search matches when all present', jobMatchesSearch(reactJob, 'react acme'));
ok('legacy job is still searchable by title', jobMatchesSearch(legacyJob, 'ai'));
ok('legacy salary text is searchable', jobMatchesSearch(legacyJob, '80k'));

console.log('\nE2. Search against realistic posted data (regression for the reported bug)');
// The three jobs used for manual/browser verification.
const seedPool = [
  normalizeJob({ id: 's1', title: 'Frontend Engineer', company: 'Acme Labs', location: 'Bengaluru, India',
    skills: ['React', 'TypeScript'], category: 'Software Development', workMode: 'Hybrid' }),
  normalizeJob({ id: 's2', title: 'Data Analyst', company: 'Globex', location: 'Mumbai, India',
    skills: ['SQL', 'Python'], category: 'Data Analytics', workType: 'Contract', workMode: 'On-site',
    experienceLevel: '5-8 years' }),
  normalizeJob({ id: 's3', title: 'Marketing Intern', company: 'Initech', location: 'Remote',
    skills: ['Content', 'SEO'], category: 'Marketing', workType: 'Internship', workMode: 'Remote',
    experienceLevel: 'Entry Level' })
];
const ids = (search) => filterJobs(seedPool, { search, filters: EMPTY_FILTERS }).map(j => j.id);
eq('partial job title', ids('Front'), ['s1']);
eq('job title, different case', ids('ENGINEER'), ['s1']);
eq('mid-word title match', ids('nalyst'), ['s2']);
eq('company name', ids('acme'), ['s1']);
eq('company name, different case', ids('GLOBEX'), ['s2']);
eq('location', ids('bengaluru'), ['s1']);
eq('skill', ids('sql'), ['s2']);
eq('a term in no field returns nothing', ids('zzzz'), []);
eq('empty search returns everything', filterJobs(seedPool, { search: '', filters: EMPTY_FILTERS }).length, 3);
eq('whitespace-only search returns everything', filterJobs(seedPool, { search: '   ', filters: EMPTY_FILTERS }).length, 3);
eq('search + filter (both match)', filterJobs(seedPool, { search: 'Engineer', filters: { ...EMPTY_FILTERS, category: 'Software Development' } }).map(j => j.id), ['s1']);
eq('search + contradicting filter returns nothing', filterJobs(seedPool, { search: 'Engineer', filters: { ...EMPTY_FILTERS, category: 'Marketing' } }).map(j => j.id), []);
eq('search across two fields', ids('acme bengaluru'), ['s1']);
eq('search terms all required', ids('acme mumbai'), []);

console.log('\nF. Filters use ONLY real stored fields');
ok('no filters -> matches', jobMatchesFilters(reactJob, EMPTY_FILTERS));
ok('work type matches', jobMatchesFilters(reactJob, { workType: 'Full-time' }));
ok('wrong work type is rejected', !jobMatchesFilters(reactJob, { workType: 'Part-time' }));
ok('work mode matches', jobMatchesFilters(reactJob, { workMode: 'Hybrid' }));
ok('wrong work mode is rejected', !jobMatchesFilters(reactJob, { workMode: 'Remote' }));
ok('category matches', jobMatchesFilters(reactJob, { category: 'Software Development' }));
ok('wrong category is rejected', !jobMatchesFilters(reactJob, { category: 'Design' }));
ok('category is NEVER inferred from the title', !jobMatchesFilters(
  normalizeJob({ title: 'Senior Frontend Developer', description: 'design system' }),
  { category: 'Design' }
));
ok('experience matches', jobMatchesFilters(reactJob, { experienceLevel: '5-8 years' }));
ok('skill matches exactly', jobMatchesFilters(reactJob, { skill: 'React' }));
ok('skill is NOT a fuzzy title match', !jobMatchesFilters(reactJob, { skill: 'Design' }));
ok('min salary accepts a job at/above the band', jobMatchesFilters(reactJob, { minSalary: '100000' }));
ok('min salary rejects a lower-paying job', !jobMatchesFilters(reactJob, { minSalary: '150000' }));
ok('min salary works on legacy jobs via the string', jobMatchesFilters(legacyJob, { minSalary: '80000' }));
ok('no readable salary cannot satisfy a salary filter', !jobMatchesFilters(normalizeJob({ title: 'x' }), { minSalary: '1000' }));
ok('legacy job without workType never matches a workType filter', !jobMatchesFilters(legacyJob, { workType: 'Full-time' }));
ok('legacy "Remote" location DOES match the Remote work mode', jobMatchesFilters(legacyJob, { workMode: 'Remote' }));
ok('location matches partially', jobMatchesFilters(reactJob, { location: 'new york' }));

console.log('\nG. Search + filters combine with AND logic');
const pool = [reactJob, legacyJob, weirdJob];
eq('empty search + no filters returns all', filterJobs(pool, { search: '', filters: EMPTY_FILTERS }).length, 3);
eq('search narrows the list', filterJobs(pool, { search: 'react', filters: EMPTY_FILTERS }).length, 1);
// The example from the specification: React + Software Development + 0-2 years +
// Remote + Full-time. The React job is 5-8 years/Hybrid so it must NOT match.
eq('React + Software Development + 0-2 years + Remote + Full-time -> 0 (AND)', filterJobs(pool, {
  search: 'React',
  filters: { ...EMPTY_FILTERS, category: 'Software Development', experienceLevel: '0-2 years', workMode: 'Remote', workType: 'Full-time' }
}).length, 0);
eq('the same but with the matching experience level -> 1', filterJobs(pool, {
  search: 'React',
  filters: { ...EMPTY_FILTERS, category: 'Software Development', experienceLevel: '5-8 years', workMode: 'Hybrid', workType: 'Full-time' }
}).length, 1);
eq('category filter alone works', filterJobs(pool, { search: '', filters: { ...EMPTY_FILTERS, category: 'Finance' } }).map(j => j.id), ['j2']);
eq('search + a work mode the job lacks (AND)', filterJobs(pool, { search: 'react', filters: { ...EMPTY_FILTERS, workMode: 'On-site' } }).length, 0);
eq('search + a skill the job lacks (AND)', filterJobs(pool, { search: 'react', filters: { ...EMPTY_FILTERS, skill: 'Go' } }).length, 0);
eq('search + min salary at the exact band', filterJobs(pool, { search: 'react', filters: { ...EMPTY_FILTERS, minSalary: '100000' } }).length, 1);

console.log('\nH. Filter state helpers');
ok('no filters active', !hasActiveFilters(EMPTY_FILTERS));
ok('work type counts as active', hasActiveFilters({ ...EMPTY_FILTERS, workType: 'Full-time' }));
ok('category counts as active', hasActiveFilters({ ...EMPTY_FILTERS, category: 'Design' }));
ok('work mode counts as active', hasActiveFilters({ ...EMPTY_FILTERS, workMode: 'Remote' }));
ok('empty strings are not active', !hasActiveFilters(normalizeFilters({ workType: '', minSalary: '', category: '' })));
eq('select values normalise to strings', normalizeFilters({ workType: 'Full-time', minSalary: 80000, category: 'Design' }), { ...EMPTY_FILTERS, workType: 'Full-time', minSalary: '80000', category: 'Design' });
eq('the legacy `remote` boolean key is gone from EMPTY_FILTERS', 'remote' in EMPTY_FILTERS, false);

console.log('\nI. Application status shown on job cards');
const map = indexApplicationsByJob([
  { id: 'a1', jobId: 'j1', status: 'pending', appliedAt: { seconds: 1000 } },
  { id: 'a2', jobId: 'j2', status: 'rejected', appliedAt: { seconds: 2000 } },
  { id: 'a3', jobId: 'j2', status: 'accepted', appliedAt: { seconds: 500 } }
]);
eq('pending is indexed', map.j1.status, 'pending');
eq('the most recent application wins for a job', map.j2.status, 'rejected');
eq('an unapplied job is absent from the map', map.j9, undefined);
eq('status labels are human readable', [getApplicationStatusMeta('pending').label, getApplicationStatusMeta('accepted').label, getApplicationStatusMeta('rejected').label], ['Pending', 'Accepted', 'Rejected']);
eq('status badge classes match the existing CSS', [getApplicationStatusMeta('pending').className, getApplicationStatusMeta('accepted').className, getApplicationStatusMeta('rejected').className], ['pending', 'accepted', 'rejected']);
eq('an unknown status falls back to pending', getApplicationStatusMeta('interview').label, 'Pending');

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====\n`);
process.exit(fail ? 1 : 0);
