/**
 * SkillSync - Interactive Mock Interview Answer Simulator Engine
 * File: assets/js/modules/interview.js
 *
 * Universal UMD module for analyzing and scoring candidate behavioral & technical
 * answers against key talking points, STAR methodology metrics, and production keywords.
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

  const IMPACT_KEYWORDS = [
    'reduce', 'reduced', 'increase', 'increased', 'optimiz', 'scale', 'built',
    'architect', 'led', 'deliver', 'metric', 'latency', 'throughput', 'percent',
    '%', 'test', 'monitor', 'failover', 'refactor', 'cache', 'pipeline'
  ];

  function evaluateInterviewAnswer(questionObj = {}, userAnswer = '') {
    const answer = String(userAnswer || '').trim();
    const talkingPoints = Array.isArray(questionObj.talking_points) ? questionObj.talking_points : [];

    if (!answer || answer.length < 15) {
      return {
        score: 20,
        grade: 'Needs Practice',
        coveredPoints: [],
        missingPoints: talkingPoints,
        critique: 'Response is too brief. Provide technical specifics detailing Situation, Task, Action taken, and measurable Results.'
      };
    }

    const lowerAnswer = answer.toLowerCase();
    const covered = [];
    const missing = [];

    talkingPoints.forEach(pt => {
      const words = pt.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => lowerAnswer.includes(w));
      if (matches.length >= 1) {
        covered.push(pt);
      } else {
        missing.push(pt);
      }
    });

    const impactMatches = IMPACT_KEYWORDS.filter(k => lowerAnswer.includes(k));
    const hasImpact = impactMatches.length >= 2;

    const pointsRatio = talkingPoints.length > 0 ? (covered.length / talkingPoints.length) : 0.8;
    const coverageScore = Math.round(pointsRatio * 60);
    const impactScore = hasImpact ? 25 : (impactMatches.length > 0 ? 15 : 5);
    const lengthScore = answer.length > 150 ? 15 : (answer.length > 60 ? 10 : 5);

    const score = Math.min(100, Math.max(30, coverageScore + impactScore + lengthScore));

    let grade = 'Needs Practice';
    let critique = '';

    if (score >= 80) {
      grade = 'Exceptional Delivery';
      critique = `Excellent response covering ${covered.length} of ${talkingPoints.length} core talking points with quantifiable metrics and production impact.`;
    } else if (score >= 60) {
      grade = 'Strong Answer';
      critique = `Solid answer covering ${covered.length} key points. To achieve Staff/Lead level, incorporate concrete latency benchmarks or architectural trade-offs.`;
    } else {
      grade = 'Needs Practice';
      critique = `Addressed ${covered.length} of ${talkingPoints.length} concepts. Make sure to cover: ${missing.slice(0, 2).join(' and ')}.`;
    }

    return {
      score,
      grade,
      coveredPoints: covered,
      missingPoints: missing,
      critique
    };
  }

  return {
    IMPACT_KEYWORDS,
    evaluateInterviewAnswer
  };
});
