/**
 * SkillSync - Standalone Job Discovery & Facet Filtering Engine
 * File: assets/js/modules/discovery_engine.js
 *
 * Universal UMD module for querying, category classification, multi-facet filtering,
 * and client-side pagination across job listings.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncDiscoveryEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORY_MAP = {
    frontend: ['react', 'vue', 'angular', 'svelte', 'frontend', 'ui', 'css', 'next.js'],
    backend: ['node', 'python', 'go', 'golang', 'java', 'php', 'backend', 'api', 'fastapi', 'django', 'laravel'],
    devops: ['devops', 'kubernetes', 'docker', 'terraform', 'aws', 'cloud', 'sre', 'ci/cd', 'infrastructure'],
    ai: ['ai', 'ml', 'machine learning', 'llm', 'nlp', 'data science', 'vector', 'deep learning'],
    fullstack: ['fullstack', 'full-stack', 'full stack']
  };

  function categorizeJob(job) {
    if (!job) return 'General Engineering';
    const title = (job.title || '').toLowerCase();
    const allText = `${title} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase();

    // Check title first for primary specialization
    if (title.includes('frontend') || title.includes('front-end') || title.includes('ui/ux')) return 'Frontend';
    if (title.includes('backend') || title.includes('back-end') || title.includes('systems engineer')) return 'Backend';
    if (title.includes('fullstack') || title.includes('full-stack') || title.includes('full stack')) return 'Full-Stack';
    if (title.includes('devops') || title.includes('sre') || title.includes('infrastructure') || title.includes('platform engineer')) return 'Cloud & DevOps';
    if (title.includes('ai') || title.includes('ml') || title.includes('machine learning') || title.includes('data engineer')) return 'AI / Machine Learning';

    // Fallback to tags and description
    if (CATEGORY_MAP.ai.some(k => allText.includes(k))) return 'AI / Machine Learning';
    if (CATEGORY_MAP.frontend.some(k => allText.includes(k))) return 'Frontend';
    if (CATEGORY_MAP.backend.some(k => allText.includes(k))) return 'Backend';
    if (CATEGORY_MAP.fullstack.some(k => allText.includes(k))) return 'Full-Stack';
    if (CATEGORY_MAP.devops.some(k => allText.includes(k))) return 'Cloud & DevOps';

    return 'General Engineering';
  }

  function filterJobs(jobs = [], options = {}) {
    if (!Array.isArray(jobs)) return [];

    const query = (options.query || '').trim().toLowerCase();
    const category = (options.category || 'all').toLowerCase();
    const remoteOnly = Boolean(options.remoteOnly);

    return jobs.filter(job => {
      if (!job) return false;

      // 1. Remote filter
      if (remoteOnly && !job.remote) {
        return false;
      }

      // 2. Category filter
      if (category !== 'all') {
        const jobCat = categorizeJob(job).toLowerCase();
        if (category === 'ai' && !jobCat.includes('ai') && !jobCat.includes('machine learning')) return false;
        if (category === 'frontend' && !jobCat.includes('frontend')) return false;
        if (category === 'backend' && !jobCat.includes('backend')) return false;
        if (category === 'devops' && !jobCat.includes('devops') && !jobCat.includes('cloud')) return false;
        if (category === 'fullstack' && !jobCat.includes('full-stack') && !jobCat.includes('fullstack')) return false;
      }

      // 3. Text query filter
      if (query) {
        const titleMatch = (job.title || '').toLowerCase().includes(query);
        const companyMatch = (job.company_name || '').toLowerCase().includes(query);
        const descMatch = (job.description || '').toLowerCase().includes(query);
        const tagMatch = Array.isArray(job.tags) && job.tags.some(t => String(t).toLowerCase().includes(query));

        if (!titleMatch && !companyMatch && !descMatch && !tagMatch) {
          return false;
        }
      }

      return true;
    });
  }

  function paginateJobs(items = [], page = 1, perPage = 10) {
    const totalItems = Array.isArray(items) ? items.length : 0;
    const safePerPage = Math.max(1, parseInt(perPage, 10) || 10);
    const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
    const safePage = Math.max(1, Math.min(parseInt(page, 10) || 1, totalPages));

    const startIndex = (safePage - 1) * safePerPage;
    const endIndex = Math.min(startIndex + safePerPage, totalItems);
    const paginatedItems = totalItems > 0 ? items.slice(startIndex, endIndex) : [];

    return {
      page: safePage,
      perPage: safePerPage,
      totalPages,
      totalItems,
      startIndex: totalItems > 0 ? startIndex + 1 : 0,
      endIndex,
      items: paginatedItems,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1
    };
  }

  return {
    CATEGORY_MAP,
    categorizeJob,
    filterJobs,
    paginateJobs
  };
});
