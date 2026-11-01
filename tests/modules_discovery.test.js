/**
 * SkillSync - Standalone Job Discovery Engine Test Suite
 * File: tests/modules_discovery.test.js
 */

const {
  categorizeJob,
  filterJobs,
  paginateJobs
} = require('../assets/js/modules/discovery_engine.js');

describe('Standalone Job Discovery Engine Module Tests', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Senior Frontend Engineer',
      company_name: 'Vercel',
      tags: ['React', 'Next.js', 'TypeScript'],
      remote: true,
      description: 'Build fast frontend UI.'
    },
    {
      id: 'job-2',
      title: 'Distributed Systems Backend Engineer',
      company_name: 'Stripe',
      tags: ['Go', 'PostgreSQL', 'Docker'],
      remote: false,
      description: 'Scale payment infrastructure.'
    },
    {
      id: 'job-3',
      title: 'AI / LLM Research Engineer',
      company_name: 'Anthropic',
      tags: ['Python', 'PyTorch', 'Vector'],
      remote: true,
      description: 'Design LLM alignment and agentic workflows.'
    },
    {
      id: 'job-4',
      title: 'Cloud DevOps Platform Engineer',
      company_name: 'HashiCorp',
      tags: ['Terraform', 'Kubernetes', 'AWS'],
      remote: true,
      description: 'Automate multi-cloud clusters.'
    }
  ];

  describe('categorizeJob', () => {
    test('identifies frontend, backend, devops, and AI categories accurately', () => {
      expect(categorizeJob(mockJobs[0])).toBe('Frontend');
      expect(categorizeJob(mockJobs[1])).toBe('Backend');
      expect(categorizeJob(mockJobs[2])).toBe('AI / Machine Learning');
      expect(categorizeJob(mockJobs[3])).toBe('Cloud & DevOps');
    });

    test('defaults to General Engineering for untyped roles', () => {
      expect(categorizeJob({ title: 'Technical Lead' })).toBe('General Engineering');
      expect(categorizeJob(null)).toBe('General Engineering');
    });
  });

  describe('filterJobs', () => {
    test('filters jobs by free-text search across title, company, or tags', () => {
      const byCompany = filterJobs(mockJobs, { query: 'stripe' });
      expect(byCompany).toHaveLength(1);
      expect(byCompany[0].company_name).toBe('Stripe');

      const byTag = filterJobs(mockJobs, { query: 'react' });
      expect(byTag).toHaveLength(1);
      expect(byTag[0].title).toContain('Frontend');
    });

    test('filters by remoteOnly flag', () => {
      const remoteJobs = filterJobs(mockJobs, { remoteOnly: true });
      expect(remoteJobs).toHaveLength(3);
      expect(remoteJobs.every(j => j.remote)).toBe(true);
    });

    test('filters by specific category', () => {
      const aiJobs = filterJobs(mockJobs, { category: 'ai' });
      expect(aiJobs).toHaveLength(1);
      expect(aiJobs[0].company_name).toBe('Anthropic');
    });

    test('returns empty array on non-array input', () => {
      expect(filterJobs(null)).toEqual([]);
    });
  });

  describe('paginateJobs', () => {
    test('calculates correct pagination bounds and slice', () => {
      const res = paginateJobs(mockJobs, 1, 2);
      expect(res.page).toBe(1);
      expect(res.totalPages).toBe(2);
      expect(res.totalItems).toBe(4);
      expect(res.items).toHaveLength(2);
      expect(res.hasNext).toBe(true);
      expect(res.hasPrev).toBe(false);
      expect(res.startIndex).toBe(1);
      expect(res.endIndex).toBe(2);
    });

    test('page 2 returns remaining items', () => {
      const res = paginateJobs(mockJobs, 2, 2);
      expect(res.page).toBe(2);
      expect(res.items).toHaveLength(2);
      expect(res.hasNext).toBe(false);
      expect(res.hasPrev).toBe(true);
      expect(res.startIndex).toBe(3);
      expect(res.endIndex).toBe(4);
    });

    test('handles empty list gracefully', () => {
      const res = paginateJobs([], 1, 10);
      expect(res.totalItems).toBe(0);
      expect(res.items).toEqual([]);
      expect(res.totalPages).toBe(1);
    });
  });
});

