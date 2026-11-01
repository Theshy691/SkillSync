/**
 * SkillSync - Public Job Explorer Page Test Suite
 * File: tests/discovery_page.test.js
 *
 * @jest-environment jsdom
 */

// Load discovery engine global first
require('../assets/js/modules/discovery_engine.js');
const {
  FALLBACK_PUBLIC_JOBS,
  setJobs,
  applyFilters,
  renderCards,
  openJobModal,
  closeJobModal,
  transferJobToAts,
  initTheme
} = require('../assets/js/discovery.js');

describe('Public Job Explorer Page Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="themeBtn"></div>
      <div id="themeBtnLabel"></div>
      <input type="text" id="discoverySearchInput" />
      <input type="checkbox" id="discoveryRemoteToggle" />
      <span id="discoveryCountText"></span>
      <div id="discoveryEmpty" style="display: none;"></div>
      <div id="discoveryJobGrid"></div>
      <div id="discoveryPagination"></div>
      <span id="pageIndicatorText"></span>
      <button id="prevPageBtn"></button>
      <button id="nextPageBtn"></button>

      <div id="jobDetailModal" style="display: none;">
        <span id="modalCompany"></span>
        <h2 id="modalRoleTitle"></h2>
        <span id="modalLocation"></span>
        <span id="modalSalary"></span>
        <div id="modalTags"></div>
        <div id="modalDescription"></div>
      </div>
    `;
    setJobs(FALLBACK_PUBLIC_JOBS);
  });

  describe('Theme Controller', () => {
    test('initializes default dark theme and toggles to light theme', () => {
      initTheme();
      const root = document.documentElement;
      const themeBtn = document.getElementById('themeBtn');
      const label = document.getElementById('themeBtnLabel');

      expect(root.getAttribute('data-theme')).toBe('dark');
      expect(label.textContent).toBe('Light mode');

      themeBtn.click();
      expect(root.getAttribute('data-theme')).toBe('light');
      expect(label.textContent).toBe('Dark mode');
      expect(localStorage.getItem('theme')).toBe('light');
    });
  });

  describe('Job Rendering & Filter Application', () => {
    test('renders job cards with titles, company names, and salary chips', () => {
      applyFilters();

      const grid = document.getElementById('discoveryJobGrid');
      expect(grid.children.length).toBeGreaterThan(0);

      const firstCard = grid.children[0];
      expect(firstCard.innerHTML).toContain('Vercel');
      expect(firstCard.innerHTML).toContain('Senior Frontend Engineer');
      expect(firstCard.innerHTML).toContain('View Details');
      expect(firstCard.innerHTML).toContain('Scan Resume');
    });

    test('filters cards dynamically by keyword query', () => {
      const searchInput = document.getElementById('discoverySearchInput');
      searchInput.value = 'Stripe';

      applyFilters();

      const grid = document.getElementById('discoveryJobGrid');
      expect(grid.children.length).toBe(1);
      expect(grid.children[0].innerHTML).toContain('Stripe');
      expect(grid.children[0].innerHTML).toContain('Distributed Systems');
    });

    test('shows empty state when no jobs match filter', () => {
      const searchInput = document.getElementById('discoverySearchInput');
      searchInput.value = 'NonExistentSkill12345';

      applyFilters();

      const grid = document.getElementById('discoveryJobGrid');
      const emptyEl = document.getElementById('discoveryEmpty');
      expect(grid.children.length).toBe(0);
      expect(emptyEl.style.display).toBe('block');
    });
  });

  describe('Job Detail Modal Lifecycle', () => {
    test('openJobModal displays modal with full job information', () => {
      const sampleJob = FALLBACK_PUBLIC_JOBS[0];
      openJobModal(sampleJob);

      const modal = document.getElementById('jobDetailModal');
      expect(modal.style.display).toBe('flex');
      expect(document.getElementById('modalCompany').textContent).toBe(sampleJob.company_name);
      expect(document.getElementById('modalRoleTitle').textContent).toBe(sampleJob.title);
      expect(document.getElementById('modalDescription').textContent).toContain('React');
    });

    test('closeJobModal hides modal display', () => {
      openJobModal(FALLBACK_PUBLIC_JOBS[0]);
      closeJobModal();

      const modal = document.getElementById('jobDetailModal');
      expect(modal.style.display).toBe('none');
    });
  });

  describe('1-Click ATS Transfer Bridge', () => {
    test('transferJobToAts sets localStorage item for ATS app pickup', () => {
      delete window.location;
      window.location = { href: '' };

      const sampleJob = FALLBACK_PUBLIC_JOBS[1];
      transferJobToAts(sampleJob);

      const saved = JSON.parse(localStorage.getItem('skillsync_pending_job_scan'));
      expect(saved.title).toBe(sampleJob.title);
      expect(saved.company).toBe(sampleJob.company_name);
      expect(window.location.href).toBe('app.html?auto_scan=1');
    });
  });
});
