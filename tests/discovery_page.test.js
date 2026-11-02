/**
 * SkillSync - Public Job Explorer Page Test Suite
 * File: tests/discovery_page.test.js
 *
 * @jest-environment jsdom
 */

// Load discovery engine and platform jobs modules globally
require('../assets/js/modules/discovery_engine.js');
window.SkillSyncPlatformJobs = require('../assets/js/modules/platform_jobs.js');

const {
  FALLBACK_PUBLIC_JOBS,
  setJobs,
  applyFilters,
  renderCards,
  openJobModal,
  closeJobModal,
  transferJobToAts,
  initTheme,
  initListeners,
  updatePlatformView,
  handlePlatformSwitch,
  handleExternalJobImport
} = require('../assets/js/discovery.js');

describe('Public Job Explorer Page Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="themeBtn"></div>
      <div id="themeBtnLabel"></div>

      <!-- Platform Selection Controls -->
      <div id="platformBar">
        <span id="platformActiveStatus">SkillSync Native</span>
        <button class="platform-pill active" data-platform="skillsync"></button>
        <button class="platform-pill" data-platform="linkedin"></button>
        <button class="platform-pill" data-platform="upwork"></button>
        <button class="platform-pill" data-platform="indeed"></button>
      </div>

      <div id="externalPlatformBanner" style="display: none;">
        <span id="platformBannerTag"></span>
        <h3 id="platformBannerTitle"></h3>
        <p id="platformBannerDesc"></p>
        <span id="platformLaunchName"></span>
        <a id="platformLaunchBtn" href="#"></a>
        <span id="importerPlatformName"></span>
        <input type="url" id="externalJobUrlInput" />
        <button id="importJobUrlBtn"></button>
      </div>

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
        <a id="modalSearchLinkedIn" href="#"></a>
        <a id="modalSearchUpwork" href="#"></a>
        <a id="modalSearchIndeed" href="#"></a>
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

  describe('Multi-Platform Chooser (LinkedIn, Upwork, Indeed)', () => {
    test('switches to LinkedIn and shows external search launcher banner', () => {
      handlePlatformSwitch('linkedin');

      const banner = document.getElementById('externalPlatformBanner');
      const title = document.getElementById('platformBannerTitle');
      const launchBtn = document.getElementById('platformLaunchBtn');
      const activeStatus = document.getElementById('platformActiveStatus');

      expect(banner.style.display).toBe('block');
      expect(title.textContent).toContain('LinkedIn');
      expect(launchBtn.href).toContain('linkedin.com/jobs/search');
      expect(activeStatus.textContent).toContain('Enterprise');
    });

    test('switches to Upwork and generates recency contract search link', () => {
      const searchInput = document.getElementById('discoverySearchInput');
      searchInput.value = 'FastAPI Python';

      handlePlatformSwitch('upwork');

      const launchBtn = document.getElementById('platformLaunchBtn');
      expect(launchBtn.href).toContain('upwork.com/nx/search/jobs');
      expect(launchBtn.href).toContain('FastAPI%20Python');
      expect(launchBtn.href).toContain('sort=recency');
    });

    test('switches back to SkillSync and hides external banner', () => {
      handlePlatformSwitch('linkedin');
      handlePlatformSwitch('skillsync');

      const banner = document.getElementById('externalPlatformBanner');
      const activeStatus = document.getElementById('platformActiveStatus');

      expect(banner.style.display).toBe('none');
      expect(activeStatus.textContent).toBe('SkillSync Native');
    });

    test('handleExternalJobImport sets pending url and redirects to app scanner', () => {
      delete window.location;
      window.location = { href: '' };

      const urlInput = document.getElementById('externalJobUrlInput');
      urlInput.value = 'https://www.linkedin.com/jobs/view/999888';

      handleExternalJobImport();

      expect(localStorage.getItem('skillsync_pending_job_url')).toBe('https://www.linkedin.com/jobs/view/999888');
      expect(window.location.href).toContain('app.html?import_url=');
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

  describe('Job Detail Modal Lifecycle & Cross-Platform Comparator', () => {
    test('openJobModal displays modal and configures cross-platform comparator links', () => {
      const sampleJob = FALLBACK_PUBLIC_JOBS[0];
      openJobModal(sampleJob);

      const modal = document.getElementById('jobDetailModal');
      expect(modal.style.display).toBe('flex');
      expect(document.getElementById('modalCompany').textContent).toBe(sampleJob.company_name);
      expect(document.getElementById('modalRoleTitle').textContent).toBe(sampleJob.title);
      expect(document.getElementById('modalDescription').textContent).toContain('React');

      const linkedInLink = document.getElementById('modalSearchLinkedIn');
      const upworkLink = document.getElementById('modalSearchUpwork');
      expect(linkedInLink.href).toContain('linkedin.com/jobs/search');
      expect(upworkLink.href).toContain('upwork.com/nx/search/jobs');
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

    test('Cmd+K shortcut focuses and selects discovery search input', () => {
      initListeners();
      const searchInput = document.getElementById('discoverySearchInput');
      searchInput.focus = jest.fn();
      searchInput.select = jest.fn();

      const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
      document.dispatchEvent(event);

      expect(searchInput.focus).toHaveBeenCalled();
      expect(searchInput.select).toHaveBeenCalled();
    });
  });
});
