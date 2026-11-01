/**
 * SkillSync - Job URL Sanitizer & Tracker Cleaner Module
 * File: assets/js/modules/url_cleaner.js
 *
 * Cleans job listing URLs by removing analytics, referral tags (UTMs, LinkedIn tracking IDs,
 * Facebook/Google click IDs), and normalizing format to improve caching efficiency.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncUrlCleaner = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'ref',
    'ref_id',
    'trk',
    'trackingid',
    'position',
    'pagenum',
    'currentjobid',
    'fbclid',
    'gclid',
    'msclkid',
    'mc_cid',
    'mc_eid',
    '_ga',
    '_gl'
  ]);

  function sanitizeJobUrl(rawUrl, options = { stripHash: true }) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return {
        isValid: false,
        cleanedUrl: '',
        hostname: '',
        originalUrl: rawUrl || '',
        strippedParams: []
      };
    }

    const trimmed = rawUrl.trim();
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (e) {
      return {
        isValid: false,
        cleanedUrl: '',
        hostname: '',
        originalUrl: rawUrl,
        strippedParams: []
      };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        cleanedUrl: '',
        hostname: parsed.hostname || '',
        originalUrl: rawUrl,
        strippedParams: []
      };
    }

    const strippedParams = [];
    const keysToDelete = [];

    parsed.searchParams.forEach((value, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      strippedParams.push(key);
      parsed.searchParams.delete(key);
    });

    if (options.stripHash) {
      parsed.hash = '';
    }

    return {
      isValid: true,
      cleanedUrl: parsed.toString(),
      hostname: parsed.hostname.toLowerCase(),
      originalUrl: rawUrl,
      strippedParams
    };
  }

  return {
    TRACKING_PARAMS: Array.from(TRACKING_PARAMS),
    sanitizeJobUrl
  };
});
