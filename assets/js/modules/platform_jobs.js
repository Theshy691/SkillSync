/**
 * SkillSync - Multi-Platform Job Search & Deep Link Engine
 * File: assets/js/modules/platform_jobs.js
 *
 * Provides platform search URL builders, platform detection from job URLs,
 * and metadata for leading tech hiring ecosystems (LinkedIn, Upwork, Indeed,
 * Wellfound, RemoteOK, Glassdoor).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncPlatformJobs = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLATFORMS = {
    skillsync: {
      id: 'skillsync',
      name: 'SkillSync Feed',
      shortName: 'Live Feed',
      type: 'internal',
      category: 'ATS Pre-Scored',
      tagline: 'Curated tech feed with 1-click ATS fit scoring',
      color: '#537a57',
      badgeBg: 'rgba(83, 122, 87, 0.12)',
      domain: 'skillsync.local',
      placeholder: 'Search tech roles, companies, or skills with instant ATS match...'
    },
    linkedin: {
      id: 'linkedin',
      name: 'LinkedIn Jobs',
      shortName: 'LinkedIn',
      type: 'external',
      category: 'Enterprise & Startups',
      tagline: 'Global corporate, startup, and direct recruiter tech roles',
      color: '#0a66c2',
      badgeBg: 'rgba(10, 102, 194, 0.12)',
      domain: 'linkedin.com',
      placeholder: 'Search roles on LinkedIn (e.g. Senior Frontend, Staff Backend)...'
    },
    upwork: {
      id: 'upwork',
      name: 'Upwork',
      shortName: 'Upwork',
      type: 'external',
      category: 'Freelance & Contract',
      tagline: 'Remote client contracts, fixed-price builds, and hourly gigs',
      color: '#14a800',
      badgeBg: 'rgba(20, 168, 0, 0.12)',
      domain: 'upwork.com',
      placeholder: 'Search freelance projects on Upwork (e.g. Next.js, FastAPI, AI)...'
    },
    indeed: {
      id: 'indeed',
      name: 'Indeed',
      shortName: 'Indeed',
      type: 'external',
      category: 'Broad Market',
      tagline: 'Comprehensive global job market across all industries',
      color: '#2164f3',
      badgeBg: 'rgba(33, 100, 243, 0.12)',
      domain: 'indeed.com',
      placeholder: 'Search jobs on Indeed (e.g. DevOps Engineer, Python Developer)...'
    },
    wellfound: {
      id: 'wellfound',
      name: 'Wellfound',
      shortName: 'Wellfound',
      type: 'external',
      category: 'Startup Ecosystem',
      tagline: 'Seed to Series D venture-backed startups and early teams',
      color: '#e03a3c',
      badgeBg: 'rgba(224, 58, 60, 0.12)',
      domain: 'wellfound.com',
      placeholder: 'Search venture-backed startup roles on Wellfound...'
    },
    remoteok: {
      id: 'remoteok',
      name: 'RemoteOK',
      shortName: 'RemoteOK',
      type: 'external',
      category: '100% Remote',
      tagline: 'Worldwide remote developer and engineering opportunities',
      color: '#ff4742',
      badgeBg: 'rgba(255, 71, 66, 0.12)',
      domain: 'remoteok.com',
      placeholder: 'Search worldwide remote positions on RemoteOK...'
    },
    glassdoor: {
      id: 'glassdoor',
      name: 'Glassdoor',
      shortName: 'Glassdoor',
      type: 'external',
      category: 'Salary & Reviews',
      tagline: 'Verified postings with salary insights and employer ratings',
      color: '#0caa41',
      badgeBg: 'rgba(12, 170, 65, 0.12)',
      domain: 'glassdoor.com',
      placeholder: 'Search verified roles with salary reviews on Glassdoor...'
    }
  };

  /**
   * Returns list of all available platforms
   */
  function getAvailablePlatforms() {
    return Object.values(PLATFORMS);
  }

  /**
   * Retrieves single platform metadata by id
   */
  function getPlatformMeta(platformId) {
    if (!platformId) return PLATFORMS.skillsync;
    const key = String(platformId).toLowerCase().trim();
    return PLATFORMS[key] || PLATFORMS.skillsync;
  }

  /**
   * Builds an external search URL for a given platform
   */
  function buildPlatformSearchUrl(platformId, query = '', options = {}) {
    const rawQ = (query || '').trim();
    const q = encodeURIComponent(rawQ || 'Software Engineer');
    const remote = Boolean(options.remoteOnly);
    const location = options.location ? encodeURIComponent(options.location) : (remote ? 'Remote' : '');

    switch (String(platformId).toLowerCase()) {
      case 'linkedin': {
        let url = `https://www.linkedin.com/jobs/search/?keywords=${q}&f_TPR=r2592000`;
        if (remote) {
          url += '&f_WT=2'; // LinkedIn remote work filter
        }
        if (location) {
          url += `&location=${location}`;
        }
        return url;
      }

      case 'upwork': {
        let url = `https://www.upwork.com/nx/search/jobs/?q=${q}&sort=recency`;
        if (remote) {
          url += '&location=Anywhere';
        }
        return url;
      }

      case 'indeed': {
        let url = `https://www.indeed.com/jobs?q=${q}`;
        if (location) {
          url += `&l=${location}`;
        } else if (remote) {
          url += '&l=Remote';
        }
        return url;
      }

      case 'wellfound': {
        let url = `https://wellfound.com/jobs?role=${q}`;
        if (remote) {
          url += '&remote=true';
        }
        return url;
      }

      case 'remoteok': {
        const tag = rawQ ? encodeURIComponent(rawQ.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()) : 'engineer';
        return `https://remoteok.com/remote-${tag}-jobs`;
      }

      case 'glassdoor': {
        let url = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}`;
        if (location) {
          url += `&locT=C&locKeyword=${location}`;
        }
        return url;
      }

      case 'skillsync':
      default: {
        let url = `jobs.html?q=${q}`;
        if (remote) url += '&remote=1';
        return url;
      }
    }
  }

  /**
   * Detects the platform identifier from a pasted job posting URL
   */
  function detectPlatformFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const lower = url.toLowerCase();

    if (lower.includes('linkedin.com')) return 'linkedin';
    if (lower.includes('upwork.com')) return 'upwork';
    if (lower.includes('indeed.com')) return 'indeed';
    if (lower.includes('wellfound.com') || lower.includes('angel.co')) return 'wellfound';
    if (lower.includes('remoteok.com') || lower.includes('remoteok.io')) return 'remoteok';
    if (lower.includes('glassdoor.com')) return 'glassdoor';

    return 'generic';
  }

  /**
   * Curated search presets for quick filtering
   */
  function getSuggestedPresets() {
    return [
      { label: 'React / Next.js', query: 'React Next.js Frontend' },
      { label: 'Python / FastAPI', query: 'Python FastAPI Backend' },
      { label: 'AI & LLM Apps', query: 'AI LLM Python LangChain' },
      { label: 'Cloud & DevOps', query: 'Kubernetes Docker AWS Terraform' },
      { label: 'Full-Stack TypeScript', query: 'TypeScript Node.js React Full-Stack' },
      { label: 'Mobile (React Native)', query: 'React Native Mobile iOS' }
    ];
  }

  return {
    PLATFORMS,
    getAvailablePlatforms,
    getPlatformMeta,
    buildPlatformSearchUrl,
    detectPlatformFromUrl,
    getSuggestedPresets
  };
});

