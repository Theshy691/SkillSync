/**
 * SkillSync - Salary Benchmarking & Negotiation Coach Engine
 * File: assets/js/modules/salary.js
 *
 * Universal UMD module for computing market salary percentiles,
 * skill premiums, and counter-offer negotiation scripts.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncSalary = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function formatCurrency(amount) {
    const num = Math.round(Number(amount) || 0);
    return '$' + num.toLocaleString();
  }

  function parseOfferAmount(currentOffer) {
    if (typeof currentOffer === 'number') {
      return currentOffer >= 0 ? Math.floor(currentOffer) : 0;
    }
    if (!currentOffer) return 0;
    const cleaned = String(currentOffer).replace(/[^0-9]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  function calculateSalaryBenchmarks(role = 'Software Engineer', location = 'Remote', skills = [], currentOffer = 0) {
    const roleLower = (role || '').toLowerCase();
    const locLower = (location || '').toLowerCase();
    let base = 115000;

    if (roleLower.includes('senior') || roleLower.includes('sr')) {
      base = 150000;
    } else if (roleLower.includes('lead') || roleLower.includes('staff') || roleLower.includes('principal')) {
      base = 185000;
    } else if (roleLower.includes('junior') || roleLower.includes('jr') || roleLower.includes('entry')) {
      base = 85000;
    }

    if (roleLower.includes('architect') || roleLower.includes('director')) {
      base = Math.max(base, 195000);
    } else if (roleLower.includes('devops') || roleLower.includes('sre') || roleLower.includes('cloud')) {
      base += 12000;
    } else if (roleLower.includes('ai') || roleLower.includes('ml') || roleLower.includes('data')) {
      base += 15000;
    }

    let locMultiplier = 1.0;
    if (locLower.includes('san francisco') || locLower.includes('sf') || locLower.includes('silicon valley')) {
      locMultiplier = 1.25;
    } else if (locLower.includes('new york') || locLower.includes('nyc')) {
      locMultiplier = 1.20;
    } else if (locLower.includes('seattle') || locLower.includes('boston')) {
      locMultiplier = 1.15;
    } else if (locLower.includes('london') || locLower.includes('uk')) {
      locMultiplier = 0.90;
    } else if (locLower.includes('remote')) {
      locMultiplier = 1.05;
    }

    let skillBonus = 0;
    const premiums = [];
    (skills || []).forEach(s => {
      const sl = (s || '').toLowerCase();
      if (sl === 'aws' || sl === 'gcp' || sl === 'kubernetes' || sl === 'docker') {
        skillBonus += 3000;
        premiums.push({ skill: s, premium: '+4% Cloud/Infra' });
      } else if (sl === 'react' || sl === 'next.js' || sl === 'typescript') {
        skillBonus += 2500;
        premiums.push({ skill: s, premium: '+3% Modern Stack' });
      } else if (sl === 'python' || sl === 'fastapi' || sl.includes('ai')) {
        skillBonus += 3500;
        premiums.push({ skill: s, premium: '+5% Systems/AI' });
      }
    });
    skillBonus = Math.min(skillBonus, 18000);

    const median = Math.round(((base * locMultiplier) + skillBonus) / 1000) * 1000;
    const p25 = Math.round((median * 0.88) / 1000) * 1000;
    const p75 = Math.round((median * 1.14) / 1000) * 1000;
    const p90 = Math.round((median * 1.28) / 1000) * 1000;

    const numOffer = parseOfferAmount(currentOffer);
    let targetCounter = Math.round((median * 1.08) / 1000) * 1000;
    let status = 'at_market';
    let diff = 0;
    let percentDiff = 0;

    if (numOffer > 0) {
      diff = numOffer - median;
      percentDiff = Math.round((diff / median) * 1000) / 10;
      if (numOffer < p25) {
        status = 'below_market';
        targetCounter = Math.round((median * 1.05) / 1000) * 1000;
      } else if (numOffer > p75) {
        status = 'above_market';
        targetCounter = Math.round((numOffer * 1.05) / 1000) * 1000;
      } else {
        status = 'at_market';
        targetCounter = Math.round(Math.max(numOffer * 1.07, median * 1.08) / 1000) * 1000;
      }
    }

    const script = `Dear [Hiring Manager / Recruiter],\n\nThank you very much for extending the offer for the ${role} position. I am enthusiastic about the opportunity to join the team and contribute to your upcoming technical milestones.\n\n` +
      (numOffer > 0
        ? `Based on comprehensive industry benchmarks for ${role} roles in ${location}, as well as my verified track record with ${skills.length > 0 ? skills.slice(0, 3).join(', ') : 'modern system architecture'}, I would like to propose a base salary of ${formatCurrency(targetCounter)}.\n\n`
        : `Based on market benchmarks for this role in ${location} and my technical background in ${skills.length > 0 ? skills.slice(0, 3).join(', ') : 'core engineering'}, I am targeting a base compensation of ${formatCurrency(targetCounter)}.\n\n`) +
      `I am confident this reflects the immediate impact I will deliver to your engineering deliverables. If there is flexibility around this figure or components like sign-on bonus and equity, I would be delighted to discuss.\n\nThank you again for your time and support.\n\nWarm regards,\n[Your Name]`;

    return {
      success: true,
      role,
      location,
      benchmarks: {
        p25,
        median,
        p75,
        p90,
        formatted_p25: formatCurrency(p25),
        formatted_median: formatCurrency(median),
        formatted_p75: formatCurrency(p75),
        formatted_p90: formatCurrency(p90),
        target_counter: targetCounter,
        formatted_counter: formatCurrency(targetCounter)
      },
      offer_analysis: {
        current_offer: numOffer,
        formatted_current: numOffer > 0 ? formatCurrency(numOffer) : 'Not specified',
        status,
        percent_diff: percentDiff,
        difference: diff
      },
      skill_premiums: premiums.slice(0, 4),
      talking_points: [
        `Benchmark alignment: The 50th percentile market rate for ${role} in ${location} is ${formatCurrency(median)}.`,
        `Core stack leverage: Deep proficiency in ${skills.length > 0 ? skills.slice(0, 3).join(', ') : 'required systems'} reduces ramp-up time to near zero.`,
        `Counter-offer recommendation: Anchor at ${formatCurrency(targetCounter)} (approx. 7-10% above baseline) leaving room for mutual compromise.`,
        `Flexible levers: If base budget is constrained, negotiate equity grants, a one-time sign-on bonus, or an accelerated 6-month review.`
      ],
      script
    };
  }

  return {
    formatCurrency,
    parseOfferAmount,
    calculateSalaryBenchmarks
  };
});
