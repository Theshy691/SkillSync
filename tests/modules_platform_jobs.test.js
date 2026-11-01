/**
 * SkillSync - Multi-Platform Job Search Engine Test Suite
 * File: tests/modules_platform_jobs.test.js
 *
 * @jest-environment node
 */

const {
  PLATFORMS,
  getAvailablePlatforms,
  getPlatformMeta,
  buildPlatformSearchUrl,
  detectPlatformFromUrl,
  getSuggestedPresets
} = require('../assets/js/modules/platform_jobs.js');

describe('Multi-Platform Job Search Module Tests', () => {
  describe('Platform Discovery & Metadata', () => {
    test('contains definitions for LinkedIn, Upwork, Indeed, Wellfound, RemoteOK, Glassdoor', () => {
      const platforms = getAvailablePlatforms();
      const ids = platforms.map(p => p.id);

      expect(ids).toContain('skillsync');
      expect(ids).toContain('linkedin');
      expect(ids).toContain('upwork');
      expect(ids).toContain('indeed');
      expect(ids).toContain('wellfound');
      expect(ids).toContain('remoteok');
      expect(ids).toContain('glassdoor');
      expect(platforms.length).toBeGreaterThanOrEqual(7);
    });

    test('getPlatformMeta returns correct platform object by id', () => {
      const upwork = getPlatformMeta('upwork');
      expect(upwork.name).toBe('Upwork');
      expect(upwork.category).toContain('Freelance');

      const linkedin = getPlatformMeta('linkedin');
      expect(linkedin.name).toBe('LinkedIn Jobs');
      expect(linkedin.color).toBe('#0a66c2');

      const fallback = getPlatformMeta('unknown_xyz');
      expect(fallback.id).toBe('skillsync');
    });
  });

  describe('Deep Search URL Generation', () => {
    test('builds LinkedIn search URL with query and remote filter', () => {
      const url = buildPlatformSearchUrl('linkedin', 'Frontend Engineer', { remoteOnly: true });
      expect(url).toContain('linkedin.com/jobs/search/?keywords=Frontend%20Engineer');
      expect(url).toContain('f_WT=2'); // LinkedIn remote code
    });

    test('builds Upwork search URL with recency sort and remote filter', () => {
      const url = buildPlatformSearchUrl('upwork', 'Full-Stack Developer', { remoteOnly: true });
      expect(url).toContain('upwork.com/nx/search/jobs/?q=Full-Stack%20Developer');
      expect(url).toContain('location=Anywhere');
      expect(url).toContain('sort=recency');
    });

    test('builds Indeed search URL with location or remote parameter', () => {
      const urlRemote = buildPlatformSearchUrl('indeed', 'DevOps', { remoteOnly: true });
      expect(urlRemote).toContain('indeed.com/jobs?q=DevOps');
      expect(urlRemote).toContain('l=Remote');

      const urlCity = buildPlatformSearchUrl('indeed', 'DevOps', { location: 'New York, NY' });
      expect(urlCity).toContain('l=New%20York%2C%20NY');
    });

    test('builds Wellfound startup search URL', () => {
      const url = buildPlatformSearchUrl('wellfound', 'AI Engineer', { remoteOnly: true });
      expect(url).toContain('wellfound.com/jobs?role=AI%20Engineer');
      expect(url).toContain('remote=true');
    });

    test('builds RemoteOK slug search URL', () => {
      const url = buildPlatformSearchUrl('remoteok', 'React TypeScript');
      expect(url).toBe('https://remoteok.com/remote-react-typescript-jobs');
    });

    test('builds Glassdoor search URL', () => {
      const url = buildPlatformSearchUrl('glassdoor', 'Software Architect');
      expect(url).toContain('glassdoor.com/Job/jobs.htm?sc.keyword=Software%20Architect');
    });

    test('defaults safely to Software Engineer when query is empty', () => {
      const url = buildPlatformSearchUrl('linkedin', '');
      expect(url).toContain('Software%20Engineer');
    });
  });

  describe('Platform Detection from Pasted URLs', () => {
    test('detects LinkedIn job URLs', () => {
      const id = detectPlatformFromUrl('https://www.linkedin.com/jobs/view/3891823901');
      expect(id).toBe('linkedin');
    });

    test('detects Upwork job URLs', () => {
      const id = detectPlatformFromUrl('https://www.upwork.com/freelance-jobs/apply/Senior-React-Dev_~01234567/');
      expect(id).toBe('upwork');
    });

    test('detects Indeed, Wellfound, RemoteOK, and Glassdoor URLs', () => {
      expect(detectPlatformFromUrl('https://www.indeed.com/viewjob?jk=12345')).toBe('indeed');
      expect(detectPlatformFromUrl('https://wellfound.com/jobs/98765-senior-dev')).toBe('wellfound');
      expect(detectPlatformFromUrl('https://remoteok.com/remote-jobs/1234')).toBe('remoteok');
      expect(detectPlatformFromUrl('https://www.glassdoor.com/job-listing/abc')).toBe('glassdoor');
    });

    test('returns generic for unrecognized job URLs and null for invalid input', () => {
      expect(detectPlatformFromUrl('https://careers.company.com/job/123')).toBe('generic');
      expect(detectPlatformFromUrl(null)).toBeNull();
      expect(detectPlatformFromUrl('')).toBeNull();
    });
  });

  describe('Search Presets', () => {
    test('returns curated tech stack search presets', () => {
      const presets = getSuggestedPresets();
      expect(presets.length).toBeGreaterThan(0);
      expect(presets[0]).toHaveProperty('label');
      expect(presets[0]).toHaveProperty('query');
    });
  });
});

