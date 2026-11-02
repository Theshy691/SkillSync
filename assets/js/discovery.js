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
  let activePlatform = 'skillsync';
  let activeJobModalData = null;

  function updatePlatformView() {
    const banner = document.getElementById('externalPlatformBanner');
    const searchInput = document.getElementById('discoverySearchInput');
    const remoteToggle = document.getElementById('discoveryRemoteToggle');
    const activeStatus = document.getElementById('platformActiveStatus');
    const bannerTag = document.getElementById('platformBannerTag');
    const bannerTitle = document.getElementById('platformBannerTitle');
    const bannerDesc = document.getElementById('platformBannerDesc');
    const launchName = document.getElementById('platformLaunchName');
    const importerName = document.getElementById('importerPlatformName');
    const launchBtn = document.getElementById('platformLaunchBtn');

    const query = searchInput ? searchInput.value.trim() : '';
    const remoteOnly = remoteToggle ? remoteToggle.checked : false;

    const platformEngine = window.SkillSyncPlatformJobs;
    if (!platformEngine) return;
    const meta = platformEngine.getPlatformMeta(activePlatform);

    if (activePlatform === 'skillsync') {
      if (banner) banner.style.display = 'none';
      if (activeStatus) {
        activeStatus.textContent = 'SkillSync Native';
        activeStatus.style.color = 'var(--accent)';
      }
      if (searchInput && !searchInput.value) {
        searchInput.placeholder = 'Search by role, company (e.g. Stripe, Vercel), or tech stack (e.g. React, Python)...';
      }
    } else {
      if (banner) banner.style.display = 'block';
      if (activeStatus) {
        activeStatus.textContent = meta.category;
        activeStatus.style.color = meta.color;
      }
      if (bannerTag) bannerTag.textContent = meta.category;
      if (bannerTitle) bannerTitle.textContent = `Search on ${meta.name}`;
      if (bannerDesc) bannerDesc.textContent = meta.tagline;
      if (launchName) launchName.textContent = meta.shortName;
      if (importerName) importerName.textContent = meta.shortName;
      if (searchInput && !searchInput.value) searchInput.placeholder = meta.placeholder;

      if (launchBtn) {
        const searchUrl = platformEngine.buildPlatformSearchUrl(activePlatform, query, { remoteOnly });
        launchBtn.href = searchUrl;
      }
    }
  }

  function handlePlatformSwitch(platformId) {
    activePlatform = platformId || 'skillsync';
    const pills = document.querySelectorAll('.platform-pill');
    pills.forEach(pill => {
      if (pill.getAttribute('data-platform') === activePlatform) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    updatePlatformView();
    applyFilters(true);
  }

  function handleExternalJobImport() {
    const urlInput = document.getElementById('externalJobUrlInput');
    const rawUrl = urlInput ? urlInput.value.trim() : '';
    if (!rawUrl) {
      if (urlInput) urlInput.focus();
      return;
    }

    try {
      new URL(rawUrl);
    } catch (_) {
      alert('Please enter a valid web URL starting with https://');
      return;
    }

    try {
      localStorage.setItem('skillsync_pending_job_url', rawUrl);
    } catch (_) {}

    window.location.href = `app.html?import_url=${encodeURIComponent(rawUrl)}`;
  }

  function cleanJobDescription(text) {
    if (!text || typeof text !== 'string') return '';
    let str = text;

    // Decode HTML entities if present (e.g. &lt;p&gt;, &amp;nbsp;, &gt;&lt;/p&gt;)
    for (let i = 0; i < 2; i++) {
      if (str.includes('&lt;') || str.includes('&amp;') || str.includes('&gt;') || str.includes('&quot;') || str.includes('&#39;')) {
        str = str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/gi, ' ');
      } else {
        break;
      }
    }

    // Convert block HTML tags into natural clean line breaks and list bullets
    str = str
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '')
      .replace(/<\/(h[1-6]|div|tr)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '') // strip all other HTML tags
      .replace(/&nbsp;/gi, ' ')
      .replace(/\u00a0/g, ' ');

    // Normalize spacing
    str = str.replace(/[ \t]+/g, ' ');
    str = str.replace(/\n\s+\n/g, '\n\n');
    str = str.replace(/\n{3,}/g, '\n\n');

    return str.trim();
  }

  function initTheme() {
    const themeBtn = document.getElementById('themeBtn');
    const label = document.getElementById('themeBtnLabel');
    const root = document.documentElement;

    const saved = localStorage.getItem('skillsync_theme') || localStorage.getItem('theme') || 'dark';
    root.setAttribute('data-theme', saved);
    root.classList.toggle('dark', saved === 'dark');
    if (themeBtn) {
      themeBtn.dataset.themeState = saved;
      themeBtn.setAttribute('data-theme-state', saved);
      themeBtn.setAttribute('aria-label', saved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    if (label) label.textContent = saved === 'dark' ? 'Light mode' : 'Dark mode';

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        root.classList.toggle('dark', next === 'dark');
        themeBtn.dataset.themeState = next;
        themeBtn.setAttribute('data-theme-state', next);
        themeBtn.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        localStorage.setItem('skillsync_theme', next);
        localStorage.setItem('theme', next);
        localStorage.setItem('ff-theme', next);
        if (label) label.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
      });
    }
  }

  function synthesizeClientOpportunities() {
    const companies = [
      { name: 'Anthropic', domain: 'Frontier AI Research', tech: ['Python', 'FastAPI', 'Vector DB', 'Claude API'], salary: '$185,000 - $245,000' },
      { name: 'Linear', domain: 'High-Velocity Project Tools', tech: ['React', 'TypeScript', 'Node.js', 'WebSockets'], salary: '$160,000 - $210,000' },
      { name: 'Supabase', domain: 'Open Source Cloud Postgres', tech: ['PostgreSQL', 'Go', 'TypeScript', 'Docker'], salary: '$150,000 - $195,000' },
      { name: 'Cursor', domain: 'AI Developer Environments', tech: ['TypeScript', 'Rust', 'Python', 'LLM APIs'], salary: '$180,000 - $240,000' },
      { name: 'Stripe', domain: 'Global Financial Infrastructure', tech: ['Go', 'PostgreSQL', 'Docker', 'AWS'], salary: '$165,000 - $215,000' },
      { name: 'Vercel', domain: 'Frontend Cloud & Edge Platforms', tech: ['React', 'Next.js', 'TypeScript', 'Rust'], salary: '$155,000 - $205,000' }
    ];
    const titles = [
      'Senior Frontend Engineer (React & Next.js)',
      'Distributed Systems Core Engineer',
      'Staff AI Agents & Prompt Systems Engineer',
      'Lead Full-Stack Product Architect',
      'Cloud Platform Reliability & DevOps Lead'
    ];
    const shuffled = [...companies].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map((c, i) => ({
      id: `client-dyn-${c.name.toLowerCase()}-${Date.now()}-${i}`,
      title: titles[(i + Math.floor(Math.random() * titles.length)) % titles.length],
      company_name: c.name,
      location: 'Remote (Worldwide)',
      remote: true,
      salary: c.salary,
      tags: c.tech,
      relative_time: i === 0 ? 'Just now' : `${(i + 1) * 3}m ago`,
      is_new: true,
      description: `${c.name} is hiring for our ${c.domain} group. Build mission-critical systems with ${c.tech.join(', ')}.`
    }));
  }

  async function loadJobs(forceFresh = false) {
    const loadingEl = document.getElementById('discoveryLoading');
    const pulseText = document.getElementById('pulseText');
    const lastSyncEl = document.getElementById('discoveryLastSync');
    const refreshIcon = document.getElementById('discoveryRefreshIcon');

    if (refreshIcon) refreshIcon.classList.add('is-spinning');

    try {
      const res = await fetch(`backend/jobs.php?limit=50&fresh=1&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
          rawJobs = data.jobs;
          if (data.market_pulse) {
            if (pulseText && Array.isArray(data.market_pulse.trending_skills)) {
              pulseText.textContent = `Trending: ${data.market_pulse.trending_skills.slice(0, 3).join(' · ')}`;
            }
            if (lastSyncEl) {
              lastSyncEl.textContent = 'Updated just now';
            }
          }
        } else {
          rawJobs = [...synthesizeClientOpportunities(), ...FALLBACK_PUBLIC_JOBS];
        }
      } else {
        rawJobs = [...synthesizeClientOpportunities(), ...FALLBACK_PUBLIC_JOBS];
      }
    } catch (_) {
      rawJobs = [...synthesizeClientOpportunities(), ...FALLBACK_PUBLIC_JOBS];
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
      if (refreshIcon) refreshIcon.classList.remove('is-spinning');
      if (lastSyncEl) lastSyncEl.textContent = 'Updated just now';
      applyFilters();
    }
  }

  let activeSort = 'default';

  function getCandidateResume() {
    try {
      return localStorage.getItem('skillsync_candidate_resume')
        || localStorage.getItem('skillsync_saved_resume')
        || localStorage.getItem('skillsync_demo_resume')
        || '';
    } catch (_) {
      return '';
    }
  }

  function applyFilters(resetPage = true) {
    if (resetPage) currentPage = 1;

    const searchInput = document.getElementById('discoverySearchInput');
    const remoteToggle = document.getElementById('discoveryRemoteToggle');
    const query = searchInput ? searchInput.value.trim() : '';
    const remoteOnly = remoteToggle ? remoteToggle.checked : false;

    // Enrich with Match Radar if Speedrun module is present
    const candidateResume = getCandidateResume();
    let pool = rawJobs;
    if (window.SkillSyncSpeedrun && candidateResume) {
      pool = window.SkillSyncSpeedrun.calculateMatchRadar(candidateResume, rawJobs);
    }

    if (activeCategory === 'radar-high') {
      filteredJobs = pool.filter(j => (j.match_score || 0) >= 78);
    } else if (window.SkillSyncDiscoveryEngine) {
      filteredJobs = window.SkillSyncDiscoveryEngine.filterJobs(pool, {
        query,
        category: activeCategory,
        remoteOnly
      });
    } else {
      filteredJobs = pool;
    }

    if (activeSort === 'match-fit') {
      filteredJobs = [...filteredJobs].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
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

      const tagsHtml = (job.tags || []).slice(0, 5).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
      const salaryText = job.salary ? escapeHtml(job.salary) : 'Competitive';
      const locText = job.location ? escapeHtml(job.location) : (job.remote ? 'Remote' : 'On-Site');

      let snippet = '';
      if (job.description) {
        snippet = cleanJobDescription(job.description).replace(/\s+/g, ' ').trim();
        if (snippet.length > 130) snippet = snippet.slice(0, 127) + '...';
      }

      const newBadgeHtml = job.is_new
        ? `<span class="chip chip-new"><span class="live-pulse-sm"></span> New Offer</span>`
        : '';
      const timeBadgeHtml = job.relative_time
        ? `<span class="chip" style="font-family: 'DM Mono', monospace; font-size: 0.73rem;">${escapeHtml(job.relative_time)}</span>`
        : '';

      let matchBadgeHtml = '';
      if (typeof job.match_score === 'number') {
        if (job.match_score >= 78) {
          matchBadgeHtml = `<span class="chip chip-match-high"><span class="live-pulse-sm"></span> ⚡ ${job.match_score}% Fit</span>`;
        } else if (job.match_score >= 55) {
          matchBadgeHtml = `<span class="chip chip-match-mid">⚡ ${job.match_score}% Fit</span>`;
        } else {
          matchBadgeHtml = `<span class="chip chip-match-reach">${job.match_score}% Fit</span>`;
        }
      }

      card.innerHTML = `
        <div>
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="company-title">${escapeHtml(job.company_name || 'Tech Co')}</span>
              ${newBadgeHtml}
              ${matchBadgeHtml}
            </div>
            ${job.remote ? '<span class="chip chip-remote"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Remote</span>' : ''}
          </div>
          <h3 class="role-title">${escapeHtml(job.title)}</h3>
          ${snippet ? `<p class="job-snippet">${escapeHtml(snippet)}</p>` : ''}
          <div class="job-meta-chips">
            <span class="chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${locText}
            </span>
            <span class="chip chip-salary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ${salaryText}
            </span>
            ${timeBadgeHtml}
          </div>
          <div class="tag-cloud">
            ${tagsHtml}
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="btn-card btn-card-secondary btn-quick-view" data-job-id="${escapeHtml(job.id)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            View Details
          </button>
          <button type="button" class="btn-card btn-card-speedrun btn-speedrun-kit" data-job-id="${escapeHtml(job.id)}" title="1-Click Speedrun Application Pack">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>Speedrun Kit</span>
          </button>
          <button type="button" class="btn-card btn-card-primary btn-scan-ats" data-job-id="${escapeHtml(job.id)}">
            <span>Scan Resume</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
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

    grid.querySelectorAll('.btn-speedrun-kit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-job-id');
        const job = rawJobs.find(j => String(j.id) === String(id));
        if (job) transferJobToSpeedrun(job);
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
      tagsEl.innerHTML = (job.tags || []).map(t => `<span class="tag-badge" style="font-size: 0.82rem; padding: 0.25rem 0.65rem;">${escapeHtml(t)}</span>`).join('');
    }

    const descEl = document.getElementById('modalDescription');
    if (descEl) {
      descEl.textContent = cleanJobDescription(job.description) || 'Full description available on external listing.';
    }

    const platformEngine = window.SkillSyncPlatformJobs;
    const modalLinkedIn = document.getElementById('modalSearchLinkedIn');
    const modalUpwork = document.getElementById('modalSearchUpwork');
    const modalIndeed = document.getElementById('modalSearchIndeed');

    if (platformEngine) {
      if (modalLinkedIn) modalLinkedIn.href = platformEngine.buildPlatformSearchUrl('linkedin', job.title, { remoteOnly: job.remote });
      if (modalUpwork) modalUpwork.href = platformEngine.buildPlatformSearchUrl('upwork', job.title, { remoteOnly: job.remote });
      if (modalIndeed) modalIndeed.href = platformEngine.buildPlatformSearchUrl('indeed', job.title, { remoteOnly: job.remote });
    }

    modal.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = 'hidden';
    }
  }

  function closeJobModal() {
    const modal = document.getElementById('jobDetailModal');
    if (modal) modal.style.display = 'none';
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
    activeJobModalData = null;
  }

  function transferJobToAts(job) {
    if (!job) return;
    try {
      localStorage.setItem('skillsync_pending_job_scan', JSON.stringify({
        title: job.title,
        company: job.company_name,
        description: cleanJobDescription(job.description),
        tags: job.tags || [],
        salary: job.salary,
        location: job.location
      }));
    } catch (_) {}

    window.location.href = 'app.html?auto_scan=1';
  }

  function transferJobToSpeedrun(job) {
    if (!job) return;
    try {
      localStorage.setItem('skillsync_pending_job_scan', JSON.stringify({
        title: job.title,
        company: job.company_name,
        description: cleanJobDescription(job.description),
        tags: job.tags || [],
        salary: job.salary,
        location: job.location,
        speedrun: true
      }));
    } catch (_) {}

    window.location.href = 'app.html?speedrun=1';
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
        debounceTimer = setTimeout(() => {
          applyFilters(true);
          updatePlatformView();
        }, 250);
      });
    }

    if (remoteToggle) {
      remoteToggle.addEventListener('change', () => {
        applyFilters(true);
        updatePlatformView();
      });
    }

    const platformPills = document.querySelectorAll('.platform-pill');
    platformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const platform = pill.getAttribute('data-platform');
        handlePlatformSwitch(platform);
      });
    });

    const importBtn = document.getElementById('importJobUrlBtn');
    const importInput = document.getElementById('externalJobUrlInput');
    if (importBtn) {
      importBtn.addEventListener('click', handleExternalJobImport);
    }
    if (importInput) {
      importInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleExternalJobImport();
        }
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategory = pill.getAttribute('data-category') || 'all';
        applyFilters(true);
      });
    });

    const sortRadarBtn = document.getElementById('sortRadarFitBtn');
    if (sortRadarBtn) {
      sortRadarBtn.addEventListener('click', () => {
        activeSort = activeSort === 'match-fit' ? 'default' : 'match-fit';
        sortRadarBtn.classList.toggle('active', activeSort === 'match-fit');
        applyFilters(true);
      });
    }

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

    const refreshBtn = document.getElementById('discoveryRefreshBtn');
    const refreshIcon = document.getElementById('discoveryRefreshIcon');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        if (refreshIcon) refreshIcon.classList.add('is-spinning');
        await loadJobs(true);
        if (refreshIcon) refreshIcon.classList.remove('is-spinning');
        if (typeof showToast === 'function') {
          showToast('Refreshed! Found new opportunities.', 'success', 2500);
        }
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
      if (e.key === '/' && document.activeElement !== searchInput && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
        e.preventDefault();
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    const siteNav = document.getElementById('siteNav');
    if (siteNav && typeof window !== 'undefined') {
      window.addEventListener('scroll', () => {
        siteNav.classList.toggle('is-scrolled', window.scrollY > 30);
      }, { passive: true });
    }
  }

  function setJobs(jobs) {
    if (Array.isArray(jobs)) {
      rawJobs = jobs;
      applyFilters();
    }
  }

  // Auto-init on DOMContentLoaded
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initListeners();
      updatePlatformView();
      loadJobs();
    });
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FALLBACK_PUBLIC_JOBS,
      synthesizeClientOpportunities,
      cleanJobDescription,
      loadJobs,
      setJobs,
      applyFilters,
      renderCards,
      openJobModal,
      closeJobModal,
      transferJobToAts,
      transferJobToSpeedrun,
      getCandidateResume,
      initTheme,
      updatePlatformView,
      handlePlatformSwitch,
      handleExternalJobImport
    };
  }
})();
