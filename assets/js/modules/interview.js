/**
 * SkillSync - Interactive Mock Interview Answer Simulator Engine
 * File: assets/js/modules/interview.js
 *
 * Universal UMD module for analyzing and scoring candidate behavioral & technical
 * answers against key talking points, STAR methodology metrics, and production keywords.
 * Natively supports trilingual evaluation: English, Tagalog, and Taglish (Filipino-English code-switching).
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncInterview = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // English impact verbs and technical nouns
  const IMPACT_KEYWORDS = [
    'reduce', 'reduced', 'increase', 'increased', 'optimiz', 'scale', 'built',
    'architect', 'led', 'deliver', 'metric', 'latency', 'throughput', 'percent',
    '%', 'test', 'monitor', 'failover', 'refactor', 'cache', 'pipeline',
    'concurrency', 'idempotent', 'microservices', 'bottleneck', 'resilient'
  ];

  // Tagalog & Taglish code-switching stems and technical action verbs
  const TAGALOG_IMPACT_KEYWORDS = [
    'nag-implement', 'nag-deploy', 'nag-scale', 'nag-optimize', 'nag-refactor',
    'nag-lead', 'nag-ayos', 'inayos', 'bumaba', 'tumaas', 'napabilis', 'napataas',
    'solusyon', 'resulta', 'sistema', 'arkitektura', 'proyekto', 'porsyento',
    'subok', 'nag-monitor', 'nag-handle', 'nag-solve', 'matagumpay', 'nagbawas',
    'nadagdagan', 'mas mabilis', 'mas matipid', 'problema', 'nag-setup', 'nag-migrate',
    'nag-integrate', 'sinolusyunan', 'binago', 'nag-test', 'nag-push'
  ];

  // Common Tagalog function particles to identify language modality
  const TAGALOG_PARTICLES = [
    'ang', 'ng', 'mga', 'sa', 'kami', 'namin', 'tayo', 'natin', 'ako', 'ko',
    'tapos', 'yung', 'para', 'ito', 'dahil', 'noong', 'kaya', 'kung', 'lahat',
    'at', 'ay', 'siya', 'nila', 'sila', 'nito', 'noon', 'bago', 'habang'
  ];

  // Common English function words used to determine code-switching modality
  const ENGLISH_FUNCTION_WORDS = [
    'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'with', 'from',
    'by', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'we', 'our', 'us', 'i', 'my', 'me', 'you', 'your', 'they', 'their', 'them',
    'this', 'that', 'these', 'those', 'and', 'but', 'or', 'so', 'because', 'when',
    'where', 'how', 'what', 'which', 'who', 'can', 'could', 'will', 'would', 'have', 'had'
  ];

  /**
   * Detects whether an answer is English, Tagalog, or Taglish
   * @param {string} text - Candidate response text
   * @returns {'English' | 'Tagalog' | 'Taglish'}
   */
  function detectAnswerLanguage(text) {
    if (!text || typeof text !== 'string') return 'English';
    const lower = text.toLowerCase();
    const words = lower.replace(/[^a-z0-9\-áéíóúñ\s]/gi, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'English';

    let tagalogCount = 0;
    let englishCount = 0;
    let hasTaglishAffix = false;

    words.forEach(w => {
      if (TAGALOG_PARTICLES.includes(w) || TAGALOG_IMPACT_KEYWORDS.includes(w)) {
        tagalogCount++;
      }
      if (/^(nag|mag|pinag|pag|ipag)-[a-z]{3,}/i.test(w)) {
        hasTaglishAffix = true;
        tagalogCount++;
      }
      if (ENGLISH_FUNCTION_WORDS.includes(w) || IMPACT_KEYWORDS.includes(w)) {
        englishCount++;
      }
    });

    // If no Tagalog markers found at all, it's English
    if (tagalogCount === 0 && !hasTaglishAffix) {
      return 'English';
    }

    // If Tagalog markers exist and English structural words are virtually absent, it's Tagalog
    if (tagalogCount >= 2 && englishCount === 0) {
      return 'Tagalog';
    }

    // If both Tagalog markers/affixes and English vocabulary coexist, it's Taglish
    if ((tagalogCount >= 1 || hasTaglishAffix) && englishCount >= 1) {
      return 'Taglish';
    }

    // High proportion of Tagalog markers
    const tagalogRatio = tagalogCount / words.length;
    if (tagalogRatio > 0.25 && englishCount <= 1) {
      return 'Tagalog';
    }

    return tagalogCount >= 1 ? 'Taglish' : 'English';
  }

  /**
   * Generates an exemplary STAR model answer for a question in the requested language
   * @param {Object} questionObj - Question data
   * @param {'English' | 'Tagalog' | 'Taglish'} language - Preferred target language
   * @returns {Object} { star_answer: string, situation_task: string, action: string, result: string, why_better: string[] }
   */
  function generateModelAnswer(questionObj = {}, language = 'English') {
    const skill = questionObj.target_skill || 'System Architecture';
    const points = Array.isArray(questionObj.talking_points) && questionObj.talking_points.length > 0
      ? questionObj.talking_points
      : ['Decouple dependencies with asynchronous workers', 'Implement caching and idempotency', 'Instrument end-to-end telemetry'];

    if (language === 'Taglish') {
      const situation = `Sa previous production project namin, nagkaroon kami ng major bottleneck around ${skill} noong nag-spike ang traffic by 3x during peak hours.`;
      const action = `Para masolusyunan ito, nag-implement ako ng ${points[0] || 'asynchronous queue'} at nag-setup ng ${points[1] || 'distributed Redis caching layer'} with idempotent consumers. Nag-add din kami ng structured telemetry metrics para agad ma-detect ang connection spikes.`;
      const result = `Dahil dito, bumaba ang p99 API latency by 45% (from 850ms down to 120ms), na-eliminate ang database deadlocks, at 100% uptime ang na-maintain kahit umabot sa 20,000 req/sec.`;
      const fullAnswer = `${situation} ${action} ${result}`;

      return {
        language: 'Taglish',
        star_answer: fullAnswer,
        situation_task: situation,
        action: action,
        result: result,
        why_better: [
          'Ginamit ang STAR method (Situation, Task, Action, Result) na malinaw ang role mo',
          'May konkreto at quantified metrics (bumaba ang latency ng 45%, 120ms, 20k req/sec)',
          'Malinaw ang technical ownership sa pag-implement ng architecture solutions'
        ]
      };
    } else if (language === 'Tagalog') {
      const situation = `Sa aming nakaraang proyekto, humarap ang aming koponan sa matinding pagbagal ng sistema kaugnay ng ${skill} noong dumami ang aktibong gumagamit.`;
      const action = `Bilang tugon, pinangunahan ko ang paglalatag ng ${points[0] || 'asynchronous processing'} at nagpatupad ng ${points[1] || 'mabisang caching'} upang maiwasan ang paulit-ulit na pagkuha ng datos sa database.`;
      const result = `Bunga nito, napabilis namin ang tugon ng sistema nang mahigit 40%, natanggal ang mga pagkabigo sa transaksyon, at nanatiling matatag ang serbisyo nang walang downtime.`;
      const fullAnswer = `${situation} ${action} ${result}`;

      return {
        language: 'Tagalog',
        star_answer: fullAnswer,
        situation_task: situation,
        action: action,
        result: result,
        why_better: [
          'Kompletong balangkas ng STAR na nagpapakita ng malinaw na pagkasunod-sunod',
          'Tukoy na sukatan ng tagumpay at matatag na epekto sa negosyo',
          'Propesyonal na paglalahad ng mga teknikal na hakbang at pagpapasya'
        ]
      };
    } else {
      // English default
      const situation = `In our production environment, we experienced critical latency bottlenecks around ${skill} when traffic surged 3.5x during high-volume customer campaigns.`;
      const action = `I led the redesign by implementing ${points[0] || 'event-driven message queues'} to decouple the ingestion pipeline, introduced ${points[1] || 'distributed caching with idempotent key validation'}, and configured automated circuit breakers to protect downstream databases.`;
      const result = `As a direct result, we reduced p99 endpoint latency by 48% (from 650ms to 95ms), supported over 25,000 concurrent requests without failure, and prevented approximately $120,000 in monthly compute over-provisioning costs.`;
      const fullAnswer = `${situation} ${action} ${result}`;

      return {
        language: 'English',
        star_answer: fullAnswer,
        situation_task: situation,
        action: action,
        result: result,
        why_better: [
          'Structured precisely in STAR format (Situation, Task, Action, Result)',
          'Includes hard quantifiable engineering metrics (48% latency drop, 95ms p99, 25k req/sec)',
          'Demonstrates high-impact technical ownership and architectural trade-off awareness'
        ]
      };
    }
  }

  /**
   * Evaluates an interview answer across English, Tagalog, and Taglish
   * @param {Object} questionObj - Question data
   * @param {string} userAnswer - Candidate response text
   * @param {Object} options - { preferredLanguage: 'Auto' | 'English' | 'Tagalog' | 'Taglish' }
   * @returns {Object} Evaluation report including score, grade, points, better answer, and critique
   */
  function evaluateInterviewAnswer(questionObj = {}, userAnswer = '', options = {}) {
    const answer = String(userAnswer || '').trim();
    const talkingPoints = Array.isArray(questionObj.talking_points) ? questionObj.talking_points : [];
    
    // Determine language
    const detectedLanguage = detectAnswerLanguage(answer);
    const targetLanguage = (options.preferredLanguage && options.preferredLanguage !== 'Auto')
      ? options.preferredLanguage
      : detectedLanguage;

    const modelAnswerObj = generateModelAnswer(questionObj, targetLanguage);

    if (!answer || answer.length < 15) {
      const briefCritique = targetLanguage === 'Taglish'
        ? 'Masyadong maikli ang sagot. Gamitin ang STAR method: ipaliwanag ang Situation, Task, mga Actions na ginawa mo, at ang measurable Results.'
        : (targetLanguage === 'Tagalog'
          ? 'Masyadong maikli ang tugon. Idetalye ang sitwasyon, iyong ginawa, at ang nasukat na resulta.'
          : 'Response is too brief. Provide technical specifics detailing Situation, Task, Action taken, and measurable Results.');

      return {
        score: 20,
        grade: targetLanguage === 'English' ? 'Needs Practice' : 'Kailangan ng Ensayo',
        language_detected: detectedLanguage,
        coveredPoints: [],
        missingPoints: talkingPoints,
        critique: briefCritique,
        better_answer: modelAnswerObj
      };
    }

    const lowerAnswer = answer.toLowerCase();
    const covered = [];
    const missing = [];

    // Evaluate talking points coverage
    talkingPoints.forEach(pt => {
      const words = pt.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => lowerAnswer.includes(w));
      if (matches.length >= 1) {
        covered.push(pt);
      } else {
        missing.push(pt);
      }
    });

    // Check impact keywords across English and Tagalog/Taglish sets
    const enImpactMatches = IMPACT_KEYWORDS.filter(k => lowerAnswer.includes(k));
    const tlImpactMatches = TAGALOG_IMPACT_KEYWORDS.filter(k => lowerAnswer.includes(k));
    const totalImpactMatches = enImpactMatches.length + tlImpactMatches.length;

    // Check for numerical metrics (e.g. 40%, 150ms, 10x, 2000, 3x)
    const hasNumericMetrics = /\b\d+(?:\.\d+)?(?:\%|ms|s|x|k|mb|gb|req)?\b/i.test(lowerAnswer);
    const hasStrongImpact = totalImpactMatches >= 2 || (totalImpactMatches >= 1 && hasNumericMetrics);

    const pointsRatio = talkingPoints.length > 0 ? (covered.length / talkingPoints.length) : 0.8;
    const coverageScore = Math.round(pointsRatio * 55);
    const impactScore = hasStrongImpact ? 25 : (totalImpactMatches > 0 ? 15 : 5);
    const lengthScore = answer.length > 180 ? 20 : (answer.length > 80 ? 12 : 6);

    const score = Math.min(100, Math.max(30, coverageScore + impactScore + lengthScore));

    let grade = 'Needs Practice';
    let critique = '';

    if (score >= 80) {
      grade = targetLanguage === 'English' ? 'Exceptional Delivery' : 'Napakahusay na Sagot';
      critique = targetLanguage === 'Taglish'
        ? `Napakahusay! Nasagot mo ang ${covered.length} sa ${talkingPoints.length} core talking points with quantifiable metrics at malinaw na impact.`
        : (targetLanguage === 'Tagalog'
          ? `Natatanging pagpapaliwanag! Naisama mo ang ${covered.length} sa ${talkingPoints.length} mahahalagang punto kasama ang mga datos ng tagumpay.`
          : `Excellent response covering ${covered.length} of ${talkingPoints.length} core talking points with quantifiable metrics and production impact.`);
    } else if (score >= 60) {
      grade = targetLanguage === 'English' ? 'Strong Answer' : 'Matatag na Sagot';
      critique = targetLanguage === 'Taglish'
        ? `Magandang sagot! Naipaliwanag mo ang ${covered.length} key points. Para mas maging pang-Staff/Lead level, dagdagan pa ng konkreto na latency benchmarks o architecture trade-offs.`
        : (targetLanguage === 'Tagalog'
          ? `Mabuting sagot na sumasaklaw sa ${covered.length} punto. Upang higit na mapataas, maglagay ng tiyak na sukatan ng latency o mga tradeoff sa arkitektura.`
          : `Solid answer covering ${covered.length} key points. To achieve Staff/Lead level, incorporate concrete latency benchmarks or architectural trade-offs.`);
    } else {
      grade = targetLanguage === 'English' ? 'Needs Practice' : 'Kailangan ng Ensayo';
      const missingHint = missing.slice(0, 2).join(' at ');
      critique = targetLanguage === 'Taglish'
        ? `Nabanggit ang ${covered.length} sa ${talkingPoints.length} konsepto. Siguraduhing ma-highlight: ${missingHint || 'konkretong teknikal na solusyon'}.`
        : (targetLanguage === 'Tagalog'
          ? `Tinalakay ang ${covered.length} sa ${talkingPoints.length} konsepto. Siguruhing masubukan ding talakayin ang: ${missingHint || 'mga teknikal na solusyon'}.`
          : `Addressed ${covered.length} of ${talkingPoints.length} concepts. Make sure to cover: ${missing.slice(0, 2).join(' and ')}.`);
    }

    return {
      score,
      grade,
      language_detected: detectedLanguage,
      coveredPoints: covered,
      missingPoints: missing,
      critique,
      better_answer: modelAnswerObj
    };
  }

  /**
   * Helper to construct a custom interview question object
   * @param {string} question - Question prompt
   * @param {string} targetSkill - Focus competency
   * @param {string} category - Category
   * @param {string[]} talkingPoints - Suggested talking points
   */
  function createCustomInterviewQuestion(question, targetSkill = 'Core Competency', category = 'Custom Practice', talkingPoints = []) {
    const qText = String(question || '').trim();
    const skill = String(targetSkill || 'Core Competency').trim();
    const cat = String(category || 'Custom Practice').trim();
    
    let defaultPoints = Array.isArray(talkingPoints) && talkingPoints.length > 0 ? talkingPoints : [];
    if (defaultPoints.length === 0) {
      defaultPoints = [
        `Clarify the core architectural requirements and scope for ${skill}`,
        `Walk through step-by-step technical implementation and trade-offs`,
        `Demonstrate measurable business outcomes and incident monitoring`
      ];
    }

    return {
      id: 'custom-' + Date.now(),
      category: cat,
      target_skill: skill,
      question: qText,
      interviewer_intent: `Assesses hands-on proficiency, problem-solving structure, and architectural communication around ${skill}.`,
      talking_points: defaultPoints,
      is_custom: true
    };
  }

  return {
    IMPACT_KEYWORDS,
    TAGALOG_IMPACT_KEYWORDS,
    TAGALOG_PARTICLES,
    detectAnswerLanguage,
    generateModelAnswer,
    evaluateInterviewAnswer,
    createCustomInterviewQuestion
  };
});
