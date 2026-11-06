/**
 * SkillSync - Live Resume Health HUD & Action Verb Analysis Engine
 * File: assets/js/modules/resume_hud.js
 *
 * Evaluates candidate resume text in real time, detecting quantified metrics,
 * identifying high-impact Google XYZ engineering verbs, and flagging passive phrasing.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncResumeHud = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const POWER_ACTION_VERBS = [
    'architected', 'spearheaded', 'engineered', 'optimized', 'automated',
    'streamlined', 'modernized', 'instrumented', 'scaled', 'delivered',
    'designed', 'orchestrated', 'authored', 'championed', 'deployed',
    'formulated', 'overhauled', 'accelerated', 'established', 'consolidated'
  ];

  const WEAK_VERB_SUGGESTIONS = {
    'helped': 'Accelerated / Spearheaded',
    'worked on': 'Engineered / Architected',
    'assisted': 'Delivered / Collaborated',
    'responsible for': 'Owned / Managed',
    'handled': 'Orchestrated / Scaled',
    'did': 'Executed / Delivered'
  };

  const METRIC_PATTERNS = [
    /\b\d+(\.\d+)?%(?!\w)/g,                                 // 44%, 12.5%
    /\$\s?\d+([,\.]\d+)?\s?[kmb]?\b/gi,                  // $1.5M, $500k, $20,000
    /\b\d+(\.\d+)?\s?(x|ms|s|req\/s|rps|tps)\b/gi,       // 3.5x, 40ms, 18000 rps
    /\b\d+\+?\s?(microservices|services|users|clients|engineers)\b/gi // 14 microservices, 100k users
  ];

  /**
   * Performs real-time health analysis on resume text
   * @param {string} text - Candidate resume text
   * @returns {Object} Analysis metrics and recommendations
   */
  function analyzeResumeHealth(text) {
    const raw = (text || '').trim();
    const charCount = raw.length;
    const words = raw ? raw.split(/\s+/) : [];
    const wordCount = words.length;

    // 1. Length scoring (ideal resume text is between 800 and 4,500 characters)
    let lengthStatus = 'insufficient'; // insufficient | optimal | dense
    let lengthScore = 0;
    if (charCount >= 800 && charCount <= 5000) {
      lengthStatus = 'optimal';
      lengthScore = 25;
    } else if (charCount > 5000) {
      lengthStatus = 'dense';
      lengthScore = 18;
    } else if (charCount >= 200) {
      lengthStatus = 'concise';
      lengthScore = 18;
    }

    // 2. Extract quantified metrics
    const foundMetrics = new Set();
    METRIC_PATTERNS.forEach(regex => {
      const matches = raw.match(regex);
      if (matches) {
        matches.forEach(m => foundMetrics.add(m.trim()));
      }
    });
    const metricCount = foundMetrics.size;
    const metricScore = Math.min(30, metricCount * 6); // Max 30 pts

    // 3. Extract power engineering verbs
    const lower = raw.toLowerCase();
    const foundPowerVerbs = new Set();
    POWER_ACTION_VERBS.forEach(verb => {
      const reg = new RegExp(`\\b${verb}\\b`, 'i');
      if (reg.test(lower)) {
        foundPowerVerbs.add(verb);
      }
    });
    const powerCount = foundPowerVerbs.size;
    const powerScore = Math.min(30, powerCount * 6); // Max 30 pts

    // 4. Identify weak passive verbs
    const weakVerbsFound = [];
    Object.keys(WEAK_VERB_SUGGESTIONS).forEach(weak => {
      const reg = new RegExp(`\\b${weak}\\b`, 'i');
      if (reg.test(lower)) {
        weakVerbsFound.push({
          word: weak,
          replacement: WEAK_VERB_SUGGESTIONS[weak]
        });
      }
    });

    const penalty = Math.min(15, weakVerbsFound.length * 5);
    const overallScore = Math.max(0, Math.min(100, Math.round(lengthScore + metricScore + powerScore + 15 - penalty)));

    return {
      charCount,
      wordCount,
      lengthStatus,
      metricCount,
      metrics: Array.from(foundMetrics),
      powerCount,
      powerVerbs: Array.from(foundPowerVerbs),
      weakVerbs: weakVerbsFound,
      score: overallScore
    };
  }

  /**
   * Generates HTML markup for the live resume HUD bar
   * @param {Object} analysis
   * @returns {string} HTML string
   */
  function renderResumeHudHtml(analysis) {
    if (!analysis) return '';

    const metricClass = analysis.metricCount >= 3 ? 'active-success' : 'active-warning';
    const powerClass = analysis.powerCount >= 3 ? 'active-success' : 'active-warning';

    const weakWarning = analysis.weakVerbs.length > 0
      ? `<span class="resume-health-pill active-warning inline-flex items-center space-x-1" title="Replace passive phrasing: ${analysis.weakVerbs.map(w => `${w.word} &rarr; ${w.replacement}`).join(', ')}">
           <svg class="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
           <span>${analysis.weakVerbs.length} weak phrase${analysis.weakVerbs.length > 1 ? 's' : ''}</span>
         </span>`
      : '';

    return `
      <div class="flex items-center space-x-2">
        <span class="font-mono text-xs opacity-70">Resume Health:</span>
        <span class="font-mono font-bold text-xs" style="color: ${analysis.score >= 75 ? 'var(--emerald, #10b981)' : analysis.score >= 50 ? 'var(--amber, #f59e0b)' : 'var(--rose, #f43f5e)'};">
          ${analysis.score}/100
        </span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="resume-health-pill ${metricClass}">
          &bull; ${analysis.metricCount} Metric${analysis.metricCount === 1 ? '' : 's'}
        </span>
        <span class="resume-health-pill ${powerClass}">
          &bull; ${analysis.powerCount} Power Verb${analysis.powerCount === 1 ? '' : 's'}
        </span>
        ${weakWarning}
      </div>
    `;
  }

  return {
    POWER_ACTION_VERBS,
    WEAK_VERB_SUGGESTIONS,
    analyzeResumeHealth,
    renderResumeHudHtml
  };
}));
