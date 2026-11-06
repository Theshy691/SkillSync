/**
 * SkillSync - Dynamic Job Offer Generation & Live Refresh Test Suite
 * File: tests/live_refresh.test.js
 *
 * @jest-environment jsdom
 */

// Load discovery engine and platform jobs
require('../assets/js/modules/discovery_engine.js');
window.SkillSyncPlatformJobs = require('../assets/js/modules/platform_jobs.js');

const {
  FALLBACK_PUBLIC_JOBS,
  synthesizeClientOpportunities,
  cleanJobDescription: cleanDiscoveryJobDesc,
  openJobModal,
  loadJobs,
  setJobs,
  renderCards
} = require('../assets/js/discovery.js');

const {
  synthesizeConsoleOpportunities,
  cleanJobDescription: cleanConsoleJobDesc,
  loadJobIntoWorkspace,
  fetchAndRenderJobs,
  recomputeAndRenderJobCards,
  setDiscoveredJobsCache
} = require('../script.js');

describe('Dynamic Job Offer Generation & Live Refresh Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    document.body.innerHTML = `
      <div id="toast-container"></div>
      <input type="text" id="discoverySearchInput" value="" />
      <input type="checkbox" id="discoveryRemoteToggle" />
      <span id="discoveryCountText"></span>
      <div id="discoveryEmpty" style="display: none;"></div>
      <div id="discoveryJobGrid"></div>
      <div id="discoveryPagination"></div>
      <span id="pageIndicatorText"></span>
      <span id="pulseText"></span>
      <span id="discoveryLastSync"></span>
      <button id="discoveryRefreshBtn">
        <svg id="discoveryRefreshIcon"></svg>
      </button>

      <!-- ATS Console Elements -->
      <textarea id="resumeText"></textarea>
      <div id="jobsLoading" class="hidden"></div>
      <div id="jobsGrid"></div>
      <div id="jobsEmpty" class="hidden"></div>
      <span id="discoveryCountBadge"></span>
      <div id="jobsPagination" class="hidden"></div>
      <span id="paginationRange"></span>
      <span id="paginationTotal"></span>
      <button id="prevJobsPageBtn"></button>
      <button id="nextJobsPageBtn"></button>
      <button id="refreshJobsBtn">
        <svg id="refreshJobsIcon"></svg>
      </button>
    `;
  });

  describe('Client Dynamic Opportunity Synthesizer', () => {
    test('generates fresh opportunities marked with is_new and relative timestamps', () => {
      const freshOffers = synthesizeClientOpportunities();
      expect(Array.isArray(freshOffers)).toBe(true);
      expect(freshOffers.length).toBeGreaterThanOrEqual(3);

      freshOffers.forEach(job => {
        expect(job.is_new).toBe(true);
        expect(job.relative_time).toBeDefined();
        expect(job.company_name).toBeDefined();
        expect(job.tags.length).toBeGreaterThan(0);
        expect(job.remote).toBe(true);
        expect(job.salary).toMatch(/\$[0-9,]+/);
      });
    });

    test('generates fresh console workspace opportunities with is_new: true', () => {
      const consoleOffers = synthesizeConsoleOpportunities();
      expect(Array.isArray(consoleOffers)).toBe(true);
      expect(consoleOffers.length).toBeGreaterThanOrEqual(3);

      consoleOffers.forEach(job => {
        expect(job.is_new).toBe(true);
        expect(job.relative_time).toBeDefined();
        expect(job.title).toBeDefined();
        expect(job.company_name).toBeDefined();
      });
    });
  });

  describe('Public Job Explorer Live Refresh Lifecycle', () => {
    test('renders role details and a comparison action without freshness decorations', () => {
      const sampleJobs = [
        {
          id: 'fresh-1',
          title: 'Staff AI Engineer',
          company_name: 'Anthropic',
          location: 'Remote',
          remote: true,
          salary: '$200,000',
          tags: ['Python', 'LLM'],
          relative_time: 'Just now',
          is_new: true,
          description: 'Frontier AI engineering.'
        },
        FALLBACK_PUBLIC_JOBS[0]
      ];

      setJobs(sampleJobs);
      renderCards();

      const grid = document.getElementById('discoveryJobGrid');
      expect(grid.children.length).toBe(2);

      const firstCardHtml = grid.children[0].innerHTML;
      expect(firstCardHtml).not.toContain('New Offer');
      expect(firstCardHtml).toContain('Compare resume');
      expect(firstCardHtml).not.toContain('Just now');
      expect(firstCardHtml).toContain('Anthropic');
    });

    test('loadJobs populates market pulse and updates last sync timestamp on refresh', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          jobs: [
            {
              id: 'dyn-vercel-1',
              title: 'Senior Next.js Architect',
              company_name: 'Vercel',
              location: 'Remote',
              remote: true,
              salary: '$180,000 - $220,000',
              tags: ['Next.js', 'React', 'TypeScript'],
              is_new: true,
              relative_time: 'Just now',
              description: 'Build edge platforms.'
            }
          ],
          market_pulse: {
            trending_skills: ['Next.js 15', 'Kubernetes', 'Go'],
            salary_median: '$165,000'
          }
        })
      });

      await loadJobs(true);

      const pulseText = document.getElementById('pulseText');
      const lastSync = document.getElementById('discoveryLastSync');

      expect(pulseText.textContent).toContain('Trending: Next.js 15 · Kubernetes · Go');
      expect(lastSync.textContent).toBe('Updated just now');

      const grid = document.getElementById('discoveryJobGrid');
      expect(grid.children.length).toBe(1);
      expect(grid.children[0].innerHTML).toContain('Senior Next.js Architect');
      expect(grid.children[0].innerHTML).toContain('Compare resume');
    });

    test('falls back to synthesized fresh opportunities when fetch fails or offline', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network offline'));

      await loadJobs(true);

      const grid = document.getElementById('discoveryJobGrid');
      expect(grid.children.length).toBeGreaterThan(0);
      // First card will be one of the synthesized dynamic opportunities
      expect(grid.children[0].innerHTML).toContain('Compare resume');
      expect(document.getElementById('discoveryLastSync').textContent).toBe('Updated just now');
    });
  });

  describe('ATS Console Workspace Refresh Lifecycle', () => {
    test('renders New badge on dynamic offers in the console feed', () => {
      const resumeInput = document.getElementById('resumeText');
      resumeInput.value = 'Engineer skilled in React, TypeScript, and Go';

      const consoleOffers = synthesizeConsoleOpportunities();
      expect(consoleOffers.length).toBeGreaterThan(0);

      const sampleJob = consoleOffers[0];
      expect(sampleJob.is_new).toBe(true);

      // Verify recomputeAndRenderJobCards renders the new badge
      setDiscoveredJobsCache([sampleJob]);
      recomputeAndRenderJobCards();

      const grid = document.getElementById('jobsGrid');
      expect(grid.children.length).toBe(1);
      expect(grid.children[0].innerHTML).toContain('New');
    });
  });

  describe('HTML Entity & Tag Cleaner (Eliminating &lt;p&gt; and &gt;&lt;/p&gt; Artifacts)', () => {
    const rawMessyHtml = '&lt;p&gt;In this role, you will collaborate closely with hardware engineering...&amp;nbsp;&lt;/p&gt;\n' +
      '&lt;p&gt;&lt;strong&gt;Responsibilities and Duties&lt;/strong&gt;&lt;/p&gt;\n' +
      '&lt;ul&gt;\n' +
      '&lt;li&gt;Operate in a highly hands-on environment.&lt;/li&gt;\n' +
      '&lt;li&gt;Ensure successful implementation.&amp;nbsp;&lt;/li&gt;\n' +
      '&lt;/ul&gt;';

    test('cleanJobDescription converts HTML entities and block tags to clean human plain text', () => {
      const cleaned = cleanDiscoveryJobDesc(rawMessyHtml);
      expect(cleaned).not.toContain('&lt;');
      expect(cleaned).not.toContain('&gt;');
      expect(cleaned).not.toContain('&amp;');
      expect(cleaned).not.toContain('&nbsp;');
      expect(cleaned).not.toContain('<p>');
      expect(cleaned).not.toContain('</p>');
      expect(cleaned).toContain('In this role, you will collaborate closely with hardware engineering...');
      expect(cleaned).toContain('Responsibilities and Duties');
      expect(cleaned).toContain('• Operate in a highly hands-on environment.');
    });

    test('openJobModal renders clean readable description without raw entity garbage', () => {
      document.body.innerHTML += `
        <div id="jobDetailModal" style="display: none;">
          <h3 id="modalRoleTitle"></h3>
          <span id="modalCompany"></span>
          <span id="modalLocation"></span>
          <span id="modalSalary"></span>
          <div id="modalTags"></div>
          <div id="modalDescription"></div>
        </div>
      `;

      openJobModal({
        id: 'test-robot-job',
        title: 'Robotics Integration Engineer',
        company_name: 'SkyRobotics',
        location: 'Remote',
        salary: '$160,000',
        tags: ['Robotics', 'Python'],
        description: rawMessyHtml
      });

      const modalDesc = document.getElementById('modalDescription').textContent;
      expect(modalDesc).not.toContain('&lt;');
      expect(modalDesc).not.toContain('&gt;');
      expect(modalDesc).not.toContain('&amp;');
      expect(modalDesc).toContain('In this role, you will collaborate closely with hardware engineering...');
      expect(modalDesc).toContain('• Operate in a highly hands-on environment.');
    });

    test('loadJobIntoWorkspace formats clean description without HTML tags', () => {
      document.body.innerHTML += `
        <textarea id="jobText"></textarea>
        <span id="jobCount"></span>
        <span id="scrapeStatusBadge"></span>
      `;

      loadJobIntoWorkspace({
        title: 'Robotics Integration Engineer',
        company_name: 'SkyRobotics',
        location: 'Remote',
        salary: '$160,000',
        tags: ['Robotics', 'Python'],
        description: rawMessyHtml
      });

      const jobVal = document.getElementById('jobText').value;
      expect(jobVal).not.toContain('&lt;');
      expect(jobVal).not.toContain('&gt;');
      expect(jobVal).not.toContain('&amp;');
      expect(jobVal).toContain('Responsibilities and Duties');
    });
  });
});
