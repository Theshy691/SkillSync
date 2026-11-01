/**
 * SkillSync - Standalone Taxonomy Module Test Suite
 * File: tests/modules_taxonomy.test.js
 */

const {
  SKILL_KEYWORDS_TAXONOMY,
  extractSkillsFromText,
  calculateMatchScore
} = require('../assets/js/modules/taxonomy.js');

describe('Standalone Taxonomy & Matcher Module Tests', () => {
  describe('SKILL_KEYWORDS_TAXONOMY', () => {
    test('contains core cloud, frontend, and backend terms', () => {
      expect(SKILL_KEYWORDS_TAXONOMY).toContain('react');
      expect(SKILL_KEYWORDS_TAXONOMY).toContain('docker');
      expect(SKILL_KEYWORDS_TAXONOMY).toContain('python');
      expect(SKILL_KEYWORDS_TAXONOMY).toContain('aws');
    });
  });

  describe('extractSkillsFromText', () => {
    test('extracts multiple skills from resume bullet points', () => {
      const sample = 'Architected microservices in Go, deployed on Kubernetes and AWS using Terraform.';
      const extracted = extractSkillsFromText(sample);
      expect(extracted).toContain('go');
      expect(extracted).toContain('kubernetes');
      expect(extracted).toContain('aws');
      expect(extracted).toContain('terraform');
    });

    test('ignores substrings in non-matching words (e.g., git in digital)', () => {
      const sample = 'Worked in a digital marketing agency handling accounts.';
      const extracted = extractSkillsFromText(sample);
      expect(extracted).not.toContain('git');
    });

    test('handles empty or non-string inputs safely', () => {
      expect(extractSkillsFromText('')).toEqual([]);
      expect(extractSkillsFromText(null)).toEqual([]);
      expect(extractSkillsFromText(undefined)).toEqual([]);
    });
  });

  describe('calculateMatchScore', () => {
    test('calculates 100% score for perfect skill match', () => {
      const candidate = ['React', 'TypeScript', 'Node.js'];
      const required = ['react', 'typescript', 'node.js'];
      const res = calculateMatchScore(candidate, required);
      expect(res.score).toBe(100);
      expect(res.rating).toBe('Strong Match');
      expect(res.missing.length).toBe(0);
    });

    test('calculates partial match and lists missing requirements', () => {
      const candidate = ['React', 'CSS3'];
      const required = ['React', 'TypeScript', 'Docker', 'Kubernetes'];
      const res = calculateMatchScore(candidate, required);
      expect(res.score).toBe(25);
      expect(res.rating).toBe('Needs Growth');
      expect(res.missing).toEqual(['TypeScript', 'Docker', 'Kubernetes']);
    });

    test('handles empty required skills with 100% baseline', () => {
      const res = calculateMatchScore(['React'], []);
      expect(res.score).toBe(100);
      expect(res.rating).toBe('Strong Match');
    });
  });
});

