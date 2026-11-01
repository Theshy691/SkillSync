/**
 * SkillSync - Job URL Sanitizer Module Test Suite
 * File: tests/modules_url.test.js
 */

const {
  TRACKING_PARAMS,
  sanitizeJobUrl
} = require('../assets/js/modules/url_cleaner.js');

describe('Standalone Job URL Sanitizer Module Tests', () => {
  describe('TRACKING_PARAMS list', () => {
    test('contains common tracking keys like utm_source, trk, and gclid', () => {
      expect(TRACKING_PARAMS).toContain('utm_source');
      expect(TRACKING_PARAMS).toContain('trk');
      expect(TRACKING_PARAMS).toContain('gclid');
      expect(TRACKING_PARAMS).toContain('fbclid');
    });
  });

  describe('sanitizeJobUrl', () => {
    test('strips utm parameters from URL and preserves essential query params', () => {
      const url = 'https://jobs.lever.co/company/job-123?utm_source=linkedin&utm_medium=referral&team=engineering';
      const result = sanitizeJobUrl(url);

      expect(result.isValid).toBe(true);
      expect(result.hostname).toBe('jobs.lever.co');
      expect(result.cleanedUrl).toBe('https://jobs.lever.co/company/job-123?team=engineering');
      expect(result.strippedParams).toContain('utm_source');
      expect(result.strippedParams).toContain('utm_medium');
    });

    test('strips hash anchors and LinkedIn tracking parameters', () => {
      const url = 'https://www.linkedin.com/jobs/view/998877?trk=public_jobs#apply-section';
      const result = sanitizeJobUrl(url);

      expect(result.isValid).toBe(true);
      expect(result.cleanedUrl).toBe('https://www.linkedin.com/jobs/view/998877');
      expect(result.strippedParams).toContain('trk');
    });

    test('rejects invalid or non-http protocols (e.g. javascript:, file:)', () => {
      const bad1 = sanitizeJobUrl('javascript:alert(1)');
      expect(bad1.isValid).toBe(false);

      const bad2 = sanitizeJobUrl('file:///etc/passwd');
      expect(bad2.isValid).toBe(false);

      const bad3 = sanitizeJobUrl('not-a-valid-url');
      expect(bad3.isValid).toBe(false);

      const bad4 = sanitizeJobUrl('');
      expect(bad4.isValid).toBe(false);
    });
  });
});
