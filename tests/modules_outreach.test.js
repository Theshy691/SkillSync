/**
 * SkillSync - Standalone Outreach Module Test Suite
 * File: tests/modules_outreach.test.js
 */

const {
  OUTREACH_LIMITS,
  getOutreachLimit,
  calculateCounterStatus,
  generateOutreachDrafts
} = require('../assets/js/modules/outreach.js');

describe('Standalone Outreach Module Tests', () => {
  describe('OUTREACH_LIMITS and getOutreachLimit', () => {
    test('enforces 300 character limit for LinkedIn connect requests', () => {
      expect(getOutreachLimit('connect')).toBe(300);
      expect(OUTREACH_LIMITS.connect).toBe(300);
    });

    test('supports inmail and coffee chat limits with fallback', () => {
      expect(getOutreachLimit('inmail')).toBe(2000);
      expect(getOutreachLimit('coffee')).toBe(1000);
      expect(getOutreachLimit('unknown')).toBe(300);
    });
  });

  describe('calculateCounterStatus', () => {
    test('returns normal status when text length is comfortably below limit', () => {
      const res = calculateCounterStatus(150, 300);
      expect(res.status).toBe('normal');
      expect(res.colorClass).toContain('text-emerald');
    });

    test('returns warning status when length exceeds 85% of limit', () => {
      const res = calculateCounterStatus(265, 300);
      expect(res.status).toBe('warning');
      expect(res.colorClass).toContain('text-amber');
    });

    test('returns overflow status when length exceeds limit', () => {
      const res = calculateCounterStatus(305, 300);
      expect(res.status).toBe('overflow');
      expect(res.colorClass).toContain('text-rose');
    });
  });

  describe('generateOutreachDrafts', () => {
    test('generates connection note under 300 characters with custom parameters', () => {
      const drafts = generateOutreachDrafts({
        company: 'Vercel',
        title: 'Platform Engineer',
        skills: ['Next.js', 'Turborepo']
      });

      expect(drafts.connect.length).toBeLessThanOrEqual(300);
      expect(drafts.connect).toContain('Vercel');
      expect(drafts.connect).toContain('Platform Engineer');
      expect(drafts.inmail).toContain('Vercel');
      expect(drafts.coffee).toContain('Vercel');
    });

    test('handles string-only company argument gracefully', () => {
      const drafts = generateOutreachDrafts('Datadog');
      expect(drafts.company).toBe('Datadog');
      expect(drafts.connect).toContain('Datadog');
    });
  });
});
