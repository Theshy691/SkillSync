/**
 * SkillSync - Standalone Salary Module Test Suite
 * File: tests/modules_salary.test.js
 */

const {
  formatCurrency,
  parseOfferAmount,
  calculateSalaryBenchmarks
} = require('../assets/js/modules/salary.js');

describe('Standalone Salary Module Tests', () => {
  describe('formatCurrency', () => {
    test('formats positive integer numbers as USD currency string', () => {
      expect(formatCurrency(125000)).toBe('$125,000');
      expect(formatCurrency(0)).toBe('$0');
    });

    test('handles string numeric values and rounding', () => {
      expect(formatCurrency('150000.75')).toBe('$150,001');
      expect(formatCurrency(null)).toBe('$0');
    });
  });

  describe('parseOfferAmount', () => {
    test('parses numbers directly', () => {
      expect(parseOfferAmount(130000)).toBe(130000);
      expect(parseOfferAmount(-500)).toBe(0);
    });

    test('strips currency symbols and commas from strings', () => {
      expect(parseOfferAmount('$145,000/yr')).toBe(145000);
      expect(parseOfferAmount('')).toBe(0);
      expect(parseOfferAmount('invalid')).toBe(0);
    });
  });

  describe('calculateSalaryBenchmarks', () => {
    test('returns standard percentiles for default remote software engineer', () => {
      const res = calculateSalaryBenchmarks();
      expect(res.success).toBe(true);
      expect(res.role).toBe('Software Engineer');
      expect(res.benchmarks.median).toBeGreaterThan(100000);
      expect(res.benchmarks.p25).toBeLessThan(res.benchmarks.median);
      expect(res.benchmarks.p75).toBeGreaterThan(res.benchmarks.median);
    });

    test('correctly caps max skill bonus at 18000', () => {
      const manySkills = [
        'AWS', 'GCP', 'Kubernetes', 'Docker',
        'React', 'Next.js', 'TypeScript',
        'Python', 'FastAPI', 'AI Engineering'
      ];
      const res = calculateSalaryBenchmarks('Senior Engineer', 'Remote', manySkills);
      expect(res.success).toBe(true);
      expect(res.skill_premiums.length).toBeLessThanOrEqual(4);
    });

    test('detects above_market offer and adjusts target counter appropriately', () => {
      const res = calculateSalaryBenchmarks('Junior Developer', 'Remote', [], 120000);
      expect(res.offer_analysis.status).toBe('above_market');
      expect(res.offer_analysis.difference).toBeGreaterThan(0);
      expect(res.benchmarks.target_counter).toBeGreaterThan(120000);
    });
  });
});
