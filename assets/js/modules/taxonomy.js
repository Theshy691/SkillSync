/**
 * SkillSync - Technical Skill Taxonomy & ATS Matcher Engine
 * File: assets/js/modules/taxonomy.js
 *
 * Universal UMD module for parsing resume texts against verified technical
 * skill taxonomies and calculating keyword match coverage.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncTaxonomy = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKILL_KEYWORDS_TAXONOMY = [
    'react', 'react native', 'vue.js', 'vue', 'angular', 'svelte', 'next.js',
    'typescript', 'javascript', 'html5', 'css3', 'tailwind css', 'tailwind',
    'node.js', 'node', 'express', 'python', 'fastapi', 'django', 'flask',
    'php', 'laravel', 'ruby', 'go', 'golang', 'rust', 'c++', 'java',
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite',
    'docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure', 'ci/cd',
    'graphql', 'rest api', 'rest', 'kafka', 'playwright', 'jest', 'linux', 'git'
  ];

  function extractSkillsFromText(text, customTaxonomy = SKILL_KEYWORDS_TAXONOMY) {
    if (!text || typeof text !== 'string') return [];
    const lower = text.toLowerCase();
    const matched = new Set();
    const taxonomy = Array.isArray(customTaxonomy) && customTaxonomy.length > 0 ? customTaxonomy : SKILL_KEYWORDS_TAXONOMY;

    taxonomy.forEach(skill => {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('(?:^|[\\s,;:.()/\\[\\]])' + escaped + '(?:$|[\\s,;:.()/\\[\\]])', 'i');
      if (regex.test(lower)) {
        matched.add(skill);
      }
    });

    return Array.from(matched);
  }

  function calculateMatchScore(candidateSkills = [], requiredSkills = []) {
    if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return {
        score: 100,
        matched: candidateSkills || [],
        missing: [],
        rating: 'Strong Match'
      };
    }

    const candidateSet = new Set((candidateSkills || []).map(s => String(s).toLowerCase().trim()));
    const matched = [];
    const missing = [];

    requiredSkills.forEach(req => {
      const normalized = String(req).toLowerCase().trim();
      if (candidateSet.has(normalized)) {
        matched.push(req);
      } else {
        missing.push(req);
      }
    });

    const score = Math.round((matched.length / requiredSkills.length) * 100);
    let rating = 'Needs Growth';
    if (score >= 75) {
      rating = 'Strong Match';
    } else if (score >= 50) {
      rating = 'Moderate Match';
    }

    return {
      score,
      matched,
      missing,
      rating
    };
  }

  return {
    SKILL_KEYWORDS_TAXONOMY,
    extractSkillsFromText,
    calculateMatchScore
  };
});
