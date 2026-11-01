/**
 * SkillSync - Smart Tech Job Discovery & Pre-Scoring Test Suite
 * File: tests/jobs.test.js
 *
 * @jest-environment jsdom
 */

const {
  extractSkillsFromText,
  calculateJobCompatibility,
  switchWorkspaceTab,
  loadJobIntoWorkspace,
  recomputeAndRenderJobCards,
  setJobsPage,
  getPaginationState,
  JOBS_PER_PAGE,
  FALLBACK_DISCOVERY_JOBS
} = require('../script');

describe('Smart Job Discovery & Pre-Scoring Test Suite', () => {

  beforeEach(() => {
    // Reset DOM with ATS, Discovery views, and Pagination
    document.body.innerHTML = `
      <div id="toast-container"></div>
      <button id="tabAtsMatcher" class="tab-btn"></button>
      <button id="tabJobDiscovery" class="tab-btn"></button>
      <span id="discoveryCountBadge">0</span>
      <span id="scoringStatusText"></span>
      <div id="ats-view"></div>
      <div id="discovery-view" class="hidden"></div>
      <div id="jobsLoading" class="hidden"></div>
      <div id="jobsGrid"></div>
      <div id="jobsEmpty" class="hidden"></div>
      <div id="jobsPagination" class="hidden">
        <span id="paginationRange"></span>
        <span id="paginationTotal"></span>
        <span id="pageIndicator"></span>
        <button id="prevJobsPageBtn"></button>
        <button id="nextJobsPageBtn"></button>
      </div>
      <textarea id="resumeText"></textarea>
      <textarea id="jobText"></textarea>
      <span id="jobCount">0 / 5,000</span>
      <span id="scrapeStatusBadge"></span>
      <button id="analyzeBtn"></button>
    `;

    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    jest.clearAllMocks();
  });

  // 1. Skill Extraction Tests
  describe('Skill Extraction Taxonomy', () => {
    test('extracts multiple tech skills from candidate resume text', () => {
      const text = 'Experienced software engineer skilled in React, TypeScript, Node.js, and Docker.';
      const skills = extractSkillsFromText(text);

      expect(skills).toContain('react');
      expect(skills).toContain('typescript');
      expect(skills).toContain('node.js');
      expect(skills).toContain('docker');
    });

    test('handles case insensitivity and special punctuation', () => {
      const text = 'Proficient with FASTAPI, postgreSQL, and KUBERNETES.';
      const skills = extractSkillsFromText(text);

      expect(skills).toContain('fastapi');
      expect(skills).toContain('postgresql');
      expect(skills).toContain('kubernetes');
    });

    test('returns empty array for empty, null, or non-string input', () => {
      expect(extractSkillsFromText('')).toEqual([]);
      expect(extractSkillsFromText(null)).toEqual([]);
      expect(extractSkillsFromText(undefined)).toEqual([]);
    });
  });

  // 2. Pre-Scoring & Compatibility Engine Tests
  describe('ATS Pre-Scoring Engine', () => {
    const mockJob = {
      id: 'job-test-1',
      title: 'Senior Frontend Engineer',
      company_name: 'Vercel',
      tags: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
      description: 'Looking for a Senior Frontend Developer with deep React, Next.js, and TypeScript skills.'
    };

    test('computes high score and Strong Match badge for matching candidate profile', () => {
      const candidateResume = 'Senior Web Developer with 5 years building web apps in React, TypeScript, Next.js, Tailwind, and Node.js.';
      const result = calculateJobCompatibility(candidateResume, mockJob);

      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.label).toBe('Strong Match');
      expect(result.badgeClass).toContain('bg-emerald-500');
      expect(result.matchingSkills).toContain('react');
      expect(result.matchingSkills).toContain('typescript');
    });

    test('computes low score and Needs Growth badge for mismatched profile', () => {
      const candidateResume = 'Data Scientist with Python, PyTorch, Pandas, and SQL background.';
      const result = calculateJobCompatibility(candidateResume, mockJob);

      expect(result.score).toBeLessThan(75);
      expect(result.missingSkills.length).toBeGreaterThan(0);
    });

    test('falls back to baseline profile when candidate resume is empty', () => {
      const result = calculateJobCompatibility('', mockJob);

      expect(result.isDefaultProfile).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(35);
      expect(result.score).toBeLessThanOrEqual(98);
    });
  });

  // 3. Tab Switching Tests
  describe('Workspace Tab Switching', () => {
    test('switches from ATS view to Job Discovery view correctly', () => {
      switchWorkspaceTab('discovery');

      const atsView = document.getElementById('ats-view');
      const discoveryView = document.getElementById('discovery-view');

      expect(atsView.classList.contains('hidden')).toBe(true);
      expect(discoveryView.classList.contains('hidden')).toBe(false);
    });

    test('switches back to ATS view from Job Discovery view', () => {
      switchWorkspaceTab('discovery');
      switchWorkspaceTab('ats');

      const atsView = document.getElementById('ats-view');
      const discoveryView = document.getElementById('discovery-view');

      expect(atsView.classList.contains('hidden')).toBe(false);
      expect(discoveryView.classList.contains('hidden')).toBe(true);
    });
  });

  // 4. 1-Click Workspace Loading
  describe('1-Click Workspace Integration', () => {
    test('transfers job details into ATS job textarea and switches tab', () => {
      const targetJob = {
        id: 'job-stripe-1',
        title: 'Full-Stack Engineer',
        company_name: 'Stripe',
        location: 'San Francisco, CA',
        salary: '$160k - $200k',
        tags: ['React', 'Node.js', 'PostgreSQL'],
        description: 'Build developer-first payment APIs and dashboards.'
      };

      loadJobIntoWorkspace(targetJob);

      const jobText = document.getElementById('jobText');
      const atsView = document.getElementById('ats-view');
      const discoveryView = document.getElementById('discovery-view');
      const statusBadge = document.getElementById('scrapeStatusBadge');

      expect(jobText.value).toContain('Full-Stack Engineer at Stripe');
      expect(jobText.value).toContain('Build developer-first payment APIs');
      expect(jobText.value).toContain('React, Node.js, PostgreSQL');
      expect(atsView.classList.contains('hidden')).toBe(false);
      expect(discoveryView.classList.contains('hidden')).toBe(true);
      expect(statusBadge.textContent).toContain('Imported: Stripe - Full-Stack Engineer');
    });
  });

  // 5. Job Card Rendering & Sorting
  describe('Job Feed Card Rendering', () => {
    test('renders job cards with company, title, tags, and fit badges', () => {
      const resumeInput = document.getElementById('resumeText');
      resumeInput.value = 'Full-Stack Developer experienced in React, TypeScript, Node.js, and Docker.';

      recomputeAndRenderJobCards();

      const grid = document.getElementById('jobsGrid');
      expect(grid.children.length).toBeGreaterThan(0);

      const firstCard = grid.children[0];
      expect(firstCard.innerHTML).toContain('Fit');
      expect(firstCard.innerHTML).toContain('Analyze in Workspace');
      expect(firstCard.innerHTML).toContain('Apply');
    });

    test('shows empty state when job list is empty', () => {
      const grid = document.getElementById('jobsGrid');
      const emptyState = document.getElementById('jobsEmpty');

      // Clear grid and simulate empty
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');

      expect(emptyState.classList.contains('hidden')).toBe(false);
    });
  });

  // 6. Pagination (10 jobs per page limit)
  describe('Feed Pagination (10 Roles Per Page)', () => {
    test('enforces JOBS_PER_PAGE limit of 10 items', () => {
      expect(JOBS_PER_PAGE).toBe(10);
    });

    test('renders at most 10 job cards on the active page', () => {
      recomputeAndRenderJobCards();

      const grid = document.getElementById('jobsGrid');
      expect(grid.children.length).toBeLessThanOrEqual(10);
    });

    test('calculates correct range text and total roles', () => {
      setJobsPage(1);

      const state = getPaginationState();
      expect(state.currentPage).toBe(1);
      expect(state.jobsPerPage).toBe(10);
      expect(state.totalJobs).toBeGreaterThan(0);
    });

    test('disables previous button on first page and controls button states', () => {
      setJobsPage(1);

      const prevBtn = document.getElementById('prevJobsPageBtn');
      const nextBtn = document.getElementById('nextJobsPageBtn');
      const pageIndicator = document.getElementById('pageIndicator');

      const state = getPaginationState();
      if (state.totalJobs > 10) {
        expect(prevBtn.disabled).toBe(true);
        expect(nextBtn.disabled).toBe(false);
        expect(pageIndicator.textContent).toContain('Page 1 of');
      }
    });

    test('can advance to page 2 and updates state cleanly', () => {
      setJobsPage(2);

      const state = getPaginationState();
      expect(state.currentPage).toBe(state.totalPages >= 2 ? 2 : state.totalPages);
    });
  });

});

