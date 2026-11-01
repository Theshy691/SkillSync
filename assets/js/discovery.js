/**
 * SkillSync - Public Job Explorer Client Controller
 * File: assets/js/discovery.js
 */

(function () {
  'use strict';

  // Fallback catalog for zero-network / local environments
  const FALLBACK_PUBLIC_JOBS = [
    {
      id: 'pub-job-1',
      title: 'Senior Frontend Engineer (React & TypeScript)',
      company_name: 'Vercel',
      location: 'Remote (Global)',
      remote: true,
      salary: '$140,000 - $185,000',
      tags: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL'],
      description: "Architect high-performance web applications using React, Next.js, and TypeScript.\n\nQualifications:\n- 4+ years of production experience with React and TypeScript.\n- Deep understanding of server-side rendering, static generation, and web performance optimization."
    },
    {
      id: 'pub-job-2',
      title: 'Distributed Systems Backend Engineer',
      company_name: 'Stripe',
      location: 'San Francisco, CA / Remote',
      remote: true,
      salary: '$150,000 - $195,000',
      tags: ['Go', 'PostgreSQL', 'Docker', 'AWS', 'Redis', 'REST API'],
      description: "Build robust payment infrastructure and high-concurrency ledger processing systems.\n\nQualifications:\n- 3+ years experience with Go or Java.\n- Strong background in relational database architecture, distributed locking, and fault tolerance."
    },
    {
      id: 'pub-job-3',
      title: 'AI Applications & Full-Stack Engineer',
      company_name: 'Anthropic',
      location: 'San Francisco, CA / Remote',
      remote: true,
      salary: '$175,000 - $230,000',
      tags: ['Python', 'TypeScript', 'React', 'FastAPI', 'LLM', 'Vector Database'],
      description: "Build developer platforms, prompt evaluation pipelines, and agentic workflows around frontier LLMs.\n\nQualifications:\n- Proficiency in Python (FastAPI/LangChain) and TypeScript (React).\n- Experience working with embedding vectors, retrieval-augmented generation (RAG), and model APIs."
    },
    {
      id: 'pub-job-4',
      title: 'Cloud DevOps & Platform Reliability Engineer',
      company_name: 'HashiCorp',
      location: 'Remote (US & Canada)',
      remote: true,
      salary: '$145,000 - $190,000',
      tags: ['Kubernetes', 'Terraform', 'Docker', 'AWS', 'CI/CD', 'Linux'],
      description: "Maintain multi-region cloud infrastructure and automated deployment pipelines.\n\nQualifications:\n- 3+ years experience with Kubernetes clusters, Terraform infrastructure-as-code, and AWS/GCP.\n- Strong Linux systems administration and bash automation skills."
    },
    {
      id: 'pub-job-5',
      title: 'Backend Engineer (Python & High-Throughput APIs)',
      company_name: 'Datadog',
      location: 'New York, NY / Remote',
      remote: true,
      salary: '$155,000 - $205,000',
      tags: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Kafka', 'Docker'],
      description: "Scale high-throughput telemetry ingestion services handling billions of events per day.\n\nQualifications:\n- Proficient in Python systems programming and async frameworks.\n- Experience with Apache Kafka message brokers and Redis caching."
    },
    {
      id: 'pub-job-6',
      title: 'Lead Full-Stack Architect',
      company_name: 'Linear',
      location: 'Remote (Worldwide)',
      remote: true,
      salary: '$165,000 - $220,000',
      tags: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'WebSockets'],
      description: "Craft hyper-fast collaborative issue tracking applications with offline-first synchronization.\n\nQualifications:\n- 5+ years of full-stack TypeScript engineering.\n- Expertise in WebSocket real-time syncing and frontend state management."
    }
  ];

  let rawJobs = [];
  let filteredJobs = [];
  let currentPage = 1;
  const PER_PAGE = 6;
  let activeCategory = 'all';
  let activeJobModalData = null;

  function initTheme() {
    const themeBtn = document.getElementById('themeBtn');
    const label = document.getElementById('themeBtnLabel');
    const root = document.documentElement;

    const saved = localStorage.getItem('theme') || 'dark';
    root.setAttribute('data-theme', saved);
    if (label) label.textContent = saved === 'dark' ? 'Light mode' : 'Dark mode';

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        if (label) label.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
      });
    }
  }

  async function loadJobs() {
    const loadingEl = document.getElementById('discoveryLoading');
    try {
      const res = await fetch('backend/jobs.php?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
          rawJobs = data.jobs;
        } else {
          rawJobs = FALLBACK_PUBLIC_JOBS;
        }
      } else {
        rawJobs = FALLBACK_PUBLIC_JOBS;
      }
    } catch (_) {
      rawJobs = FALLBACK_PUBLIC_JOBS;
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
      applyFilters();
    }
  }

  function applyFilters(resetPage = true) {
    if (resetPage) currentPage = 1;

    const searchInput = document.getElementById('discoverySearchInput');
    const remoteToggle = document.getElementById('discoveryRemoteToggle');
    const query = searchInput ? searchInput.value.trim() : '';
    const remoteOnly = remoteToggle ? remoteToggle.checked : false;

    if (window.SkillSyncDiscoveryEngine) {
      filteredJobs = window.SkillSyncDiscoveryEngine.filterJobs(rawJobs, {
        query,
        category: activeCategory,
        remoteOnly
      });
    } else {
      filteredJobs = rawJobs;
    }

    renderCards();
    updatePagination();
  }

  function renderCards() {
    const grid = document.getElementById('discoveryJobGrid');
    const emptyEl = document.getElementById('discoveryEmpty');
    const countText = document.getElementById('discoveryCountText');
    if (!grid) return;

    grid.innerHTML = '';

    if (countText) {
      countText.textContent = `Showing ${filteredJobs.length} active opportunities`;
    }

    if (filteredJobs.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
    }

    const paginated = window.SkillSyncDiscoveryEngine
      ? window.SkillSyncDiscoveryEngine.paginateJobs(filteredJobs, currentPage, PER_PAGE)
      : { items: filteredJobs.slice(0, PER_PAGE) };

    paginated.items.forEach(job => {
      const card = document.createElement('article');
      card.className = 'job-card';

      const tagsHtml = (job.tags || []).slice(0, 4).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
      const salaryText = job.salary ? escapeHtml(job.salary) : 'Competitive';
      const locText = job.location ? escapeHtml(job.location) : (job.remote ? 'Remote' : 'On-Site');

      card.innerHTML = `
        <div>
          <div class="card-header">
            <span class="company-title">${escapeHtml(job.company_name || 'Tech Co')}</span>
            ${job.remote ? '<span class="chip" style="font-size: 0.75rem; color: #10b981;">Remote</span>' : ''}
          </div>
          <h3 class="role-title">${escapeHtml(job.title)}</h3>
          <div class="job-meta-chips">
            <span class="chip">${locText}</span>
            <span class="chip chip-salary">${salaryText}</span>
          </div>
          <div class="tag-cloud">
            ${tagsHtml}
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="btn-card btn-card-secondary btn-quick-view" data-job-id="${escapeHtml(job.id)}">
            View Details
          </button>
          <button type="button" class="btn-card btn-card-primary btn-scan-ats" data-job-id="${escapeHtml(job.id)}">
            Scan Resume &rarr;
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    // Wire Card Buttons
    grid.querySelectorAll('.btn-quick-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-job-id');
        const job = rawJobs.find(j => String(j.id) === String(id));
        if (job) openJobModal(job);
      });
    });

    grid.querySelectorAll('.btn-scan-ats').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-job-id');
        const job = rawJobs.find(j => String(j.id) === String(id));
        if (job) transferJobToAts(job);
      });
    });
  }

  function updatePagination() {
    const paginated = window.SkillSyncDiscoveryEngine
      ? window.SkillSyncDiscoveryEngine.paginateJobs(filteredJobs, currentPage, PER_PAGE)
      : { page: 1, totalPages: 1, hasPrev: false, hasNext: false };

    const indicator = document.getElementById('pageIndicatorText');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const paginationWrap = document.getElementById('discoveryPagination');

    if (indicator) {
      indicator.textContent = `Page ${paginated.page} of ${paginated.totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = !paginated.hasPrev;
    if (nextBtn) nextBtn.disabled = !paginated.hasNext;

    if (paginationWrap) {
      paginationWrap.style.display = paginated.totalPages > 1 ? 'flex' : 'none';
    }
  }

  function openJobModal(job) {
    activeJobModalData = job;
    const modal = document.getElementById('jobDetailModal');
    if (!modal) return;

    document.getElementById('modalCompany').textContent = job.company_name || 'Tech Company';
    document.getElementById('modalRoleTitle').textContent = job.title;
    document.getElementById('modalLocation').textContent = job.location || (job.remote ? 'Remote' : 'Location Not Specified');
    document.getElementById('modalSalary').textContent = job.salary || 'Competitive';

    const tagsEl = document.getElementById('modalTags');
    if (tagsEl) {
      tagsEl.innerHTML = (job.tags || []).map(t => `<span class="tag-badge" style="font-size: 0.85rem;">${escapeHtml(t)}</span>`).join('');
    }

    const descEl = document.getElementById('modalDescription');
    if (descEl) {
      descEl.textContent = job.description || 'Full description available on external listing.';
    }

    modal.style.display = 'flex';
  }

  function closeJobModal() {
    const modal = document.getElementById('jobDetailModal');
    if (modal) modal.style.display = 'none';
    activeJobModalData = null;
  }

  function transferJobToAts(job) {
    if (!job) return;
    try {
      localStorage.setItem('skillsync_pending_job_scan', JSON.stringify({
        title: job.title,
        company: job.company_name,
        description: job.description,
        tags: job.tags || [],
        salary: job.salary,
        location: job.location
      }));
    } catch (_) {}

    window.location.href = 'app.html?auto_scan=1';
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initListeners() {
    const searchInput = document.getElementById('discoverySearchInput');
    const remoteToggle = document.getElementById('discoveryRemoteToggle');
    const filterPills = document.querySelectorAll('.filter-pill');
    const resetBtn = document.getElementById('resetFiltersBtn');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const closeBtnBottom = document.getElementById('closeModalBtnBottom');
    const modalScanBtn = document.getElementById('modalScanResumeBtn');
    const modalBackdrop = document.getElementById('jobDetailModal');

    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => applyFilters(true), 250);
      });
    }

    if (remoteToggle) {
      remoteToggle.addEventListener('change', () => applyFilters(true));
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategory = pill.getAttribute('data-category') || 'all';
        applyFilters(true);
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (remoteToggle) remoteToggle.checked = false;
        activeCategory = 'all';
        filterPills.forEach(p => {
          if (p.getAttribute('data-category') === 'all') p.classList.add('active');
          else p.classList.remove('active');
        });
        applyFilters(true);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderCards();
          updatePagination();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentPage++;
        renderCards();
        updatePagination();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeJobModal);
    if (closeBtnBottom) closeBtnBottom.addEventListener('click', closeJobModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeJobModal();
      });
    }

    if (modalScanBtn) {
      modalScanBtn.addEventListener('click', () => {
        if (activeJobModalData) transferJobToAts(activeJobModalData);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeJobModalData) {
        closeJobModal();
      }
    });
  }

  // Auto-init on DOMContentLoaded
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initListeners();
      loadJobs();
    });
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FALLBACK_PUBLIC_JOBS,
      applyFilters,
      renderCards,
      openJobModal,
      closeJobModal,
      transferJobToAts,
      initTheme
    };
  }
})();
