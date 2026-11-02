/**
 * SkillSync - Resume Credibility, Anomaly & Anti-Hallucination Audit Engine
 * File: assets/js/modules/authenticity.js
 *
 * Forensically analyzes resumes for:
 * 1. Tech Timeline Anachronisms (e.g. claiming 6 years of LangChain or 15 years of Kubernetes)
 * 2. Unsubstantiated Buzzword Stuffing (skills in header with 0 mentions in work experience)
 * 3. Metric Plausibility & Impossible Percentage Spikes
 * 4. Title Inflation vs Career Span (e.g. CTO/VP with < 2 years total experience)
 * 5. Ghost Contribution & Hollow Passive Phrasing
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncAuthenticity = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const TECH_BIRTH_YEARS = {
    'kubernetes': 2014,
    'k8s': 2014,
    'docker': 2013,
    'react': 2013,
    'react native': 2015,
    'vue': 2014,
    'vue.js': 2014,
    'angular': 2016, // Modern Angular 2+
    'svelte': 2016,
    'next.js': 2016,
    'nextjs': 2016,
    'nuxt': 2016,
    'typescript': 2012,
    'rust': 2015,
    'golang': 2009,
    'go': 2009,
    'flutter': 2017,
    'tailwind': 2017,
    'tailwind css': 2017,
    'graphql': 2015,
    'kafka': 2011,
    'fastapi': 2018,
    'vite': 2020,
    'bun': 2022,
    'langchain': 2022,
    'llamaindex': 2022,
    'chatgpt': 2022,
    'openai': 2020,
    'gemini': 2023,
    'claude': 2023,
    'terraform': 2014,
    'deno': 2018
  };

  const PASSIVE_GHOST_PHRASES = [
    { phrase: 'helped with', suggestion: 'Spearheaded / Orchestrated' },
    { phrase: 'assisted with', suggestion: 'Engineered / Co-architected' },
    { phrase: 'participated in', suggestion: 'Executed / Delivered' },
    { phrase: 'exposed to', suggestion: 'Implemented / Deployed' },
    { phrase: 'familiar with', suggestion: 'Proficient in' },
    { phrase: 'responsible for tasks', suggestion: 'Owned / Managed' }
  ];

  /**
   * 1. Check for Technology Timeline Anachronisms
   * Flags claims where years of experience exceed the technology's real-world existence.
   */
  function checkTechAnachronisms(text, currentYear = 2026) {
    const anomalies = [];
    const lower = (text || '').toLowerCase();

    Object.keys(TECH_BIRTH_YEARS).forEach(tech => {
      const birthYear = TECH_BIRTH_YEARS[tech];
      const maxPossibleYears = currentYear - birthYear;

      // Pattern 1: "X+ years of experience with [tech]"
      const pat1 = new RegExp(`(\\d+)\\+?\\s*(?:years?|yrs?)(?:\\s+of)?(?:\\s+experience)?(?:\\s+(?:with|in|using))?\\s+${tech}\\b`, 'i');
      // Pattern 2: "[tech]: X+ years"
      const pat2 = new RegExp(`\\b${tech}\\s*[:\\-\\(\\)]\\s*(\\d+)\\+?\\s*(?:years?|yrs?)`, 'i');

      const match1 = lower.match(pat1);
      const match2 = lower.match(pat2);

      const claimedYears = match1 ? parseInt(match1[1], 10) : (match2 ? parseInt(match2[1], 10) : null);

      if (claimedYears && claimedYears > maxPossibleYears) {
        anomalies.push({
          tech,
          claimedYears,
          maxPossibleYears,
          birthYear,
          message: `Claimed ${claimedYears} yrs of ${tech}, but ${tech} was released in ${birthYear} (max possible: ${maxPossibleYears} yrs).`
        });
      }
    });

    return anomalies;
  }

  /**
   * 2. Check for Buzzword Stuffing vs Experience Evidence
   * Compares skills listed in header vs actual project substantiation.
   */
  function checkSkillsSubstantiation(text) {
    const raw = (text || '').trim();
    if (!raw) return { listedCount: 0, evidencedCount: 0, ratio: 100, unbackedSkills: [] };

    // Detect skills section
    const skillsMatch = raw.match(/(?:skills|technical skills|competencies|technologies|tools)\s*[:\-\n]([\s\S]*?)(?=(?:\n\s*(?:experience|employment|work history|education|projects|certifications)\b)|$)/i);

    if (!skillsMatch || !skillsMatch[1]) {
      return { listedCount: 0, evidencedCount: 0, ratio: 100, unbackedSkills: [] };
    }

    const skillsBlock = skillsMatch[1].trim();
    const restOfResume = raw.replace(skillsMatch[0], '');

    // Extract individual skill tokens
    const skillTokens = skillsBlock
      .split(/[,;\n•|]/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 30 && !/^(and|languages|frameworks|tools|databases|platforms)$/i.test(s));

    const uniqueSkills = Array.from(new Set(skillTokens));
    if (uniqueSkills.length === 0) {
      return { listedCount: 0, evidencedCount: 0, ratio: 100, unbackedSkills: [] };
    }

    const unbacked = [];
    let evidencedCount = 0;

    uniqueSkills.forEach(skill => {
      const reg = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (reg.test(restOfResume)) {
        evidencedCount++;
      } else {
        unbacked.push(skill);
      }
    });

    const ratio = Math.round((evidencedCount / uniqueSkills.length) * 100);

    return {
      listedCount: uniqueSkills.length,
      evidencedCount,
      ratio,
      unbackedSkills: unbacked
    };
  }

  /**
   * 3. Metric Plausibility & Sanity Validator
   * Detects exaggerated round-percentage spikes and statistically implausible scale claims.
   */
  function checkMetricPlausibility(text) {
    const raw = (text || '').trim();
    const flags = [];

    // 1. Extreme round percentage spikes (> 1000%)
    const extremePercent = raw.match(/\b([1-9]\d{3,})%/g);
    if (extremePercent) {
      extremePercent.forEach(m => {
        flags.push({
          type: 'extreme_percentage',
          metric: m,
          message: `Claim of ${m} improvement appears statistically implausible without baseline context.`
        });
      });
    }

    // 2. Implausible scale claims (e.g. billion req/s, $100M single-handed)
    if (/\b(?:billions?|100m\+|trillions?)\s+(?:users?|requests?|transactions?)\b/i.test(raw)) {
      if (!/distributed|kafka|cassandra|sharding|cluster|aws|cloud/i.test(raw)) {
        flags.push({
          type: 'unsupported_scale',
          metric: 'Billion-scale user/request claim',
          message: 'Extreme scale claim lacks distributed infrastructure backing (Kafka, sharding, clustering).'
        });
      }
    }

    return flags;
  }

  /**
   * 4. Timeline, Seniority & Overlap Anomaly Detector
   */
  function checkTimelineSeniority(text) {
    const raw = (text || '').trim();
    const flags = [];

    // Extract years
    const yearMatches = raw.match(/\b(19\d{2}|20\d{2})\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const years = yearMatches.map(y => parseInt(y, 10)).filter(y => y >= 1990 && y <= 2030);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const spanYears = maxYear - minYear;

      // Title inflation check: Executive/Staff title with < 2 years total experience
      const hasExecTitle = /\b(cto|chief technology officer|vp of engineering|principal architect|staff engineer)\b/i.test(raw);
      if (hasExecTitle && spanYears < 2) {
        flags.push({
          type: 'seniority_mismatch',
          message: `Claimed Staff/Executive title with only ~${spanYears} year(s) of visible career timeline.`
        });
      }
    }

    // Negative range check (e.g. 2024 - 2021)
    const reversedDates = raw.match(/\b(20\d{2})\s*[-–—to]+\s*(20\d{2})\b/g);
    if (reversedDates) {
      reversedDates.forEach(range => {
        const parts = range.split(/[-–—to]+/).map(p => parseInt(p.trim(), 10));
        if (parts[0] > parts[1]) {
          flags.push({
            type: 'reversed_date_range',
            message: `Chronological contradiction in range: ${range} (start year is after end year).`
          });
        }
      });
    }

    return flags;
  }

  /**
   * 5. Ghost Contribution & Hollow Passive Language Detector
   */
  function checkGhostPhrases(text) {
    const lower = (text || '').toLowerCase();
    const found = [];

    PASSIVE_GHOST_PHRASES.forEach(item => {
      const reg = new RegExp(`\\b${item.phrase}\\b`, 'i');
      if (reg.test(lower)) {
        found.push(item);
      }
    });

    return found;
  }

  /**
   * 6. Master Audit Function
   * Computes an overall Credibility Score (0-100) and actionable breakdown.
   */
  function auditResumeIntegrity(text, currentYear = 2026) {
    const anachronisms = checkTechAnachronisms(text, currentYear);
    const substantiation = checkSkillsSubstantiation(text);
    const metricFlags = checkMetricPlausibility(text);
    const timelineFlags = checkTimelineSeniority(text);
    const ghostPhrases = checkGhostPhrases(text);

    // Score deduction breakdown:
    // Starts at 100
    let score = 100;

    // Deduct 25 pts per tech timeline anachronism (fatal recruiter flag)
    score -= anachronisms.length * 25;

    // Deduct up to 25 pts for poor skills substantiation (< 60% evidence)
    if (substantiation.listedCount >= 5 && substantiation.ratio < 60) {
      score -= Math.round((60 - substantiation.ratio) * 0.6);
    }

    // Deduct 15 pts per implausible metric flag
    score -= metricFlags.length * 15;

    // Deduct 15 pts per timeline / seniority clash
    score -= timelineFlags.length * 15;

    // Deduct 4 pts per ghost phrase
    score -= Math.min(16, ghostPhrases.length * 4);

    const safeScore = Math.max(10, Math.min(100, Math.round(score)));

    let status = 'high_integrity';
    let badgeClass = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    let label = 'Verified Credibility (Recruiter-Proof)';

    if (safeScore < 70) {
      status = 'high_risk';
      badgeClass = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
      label = 'High Embellishment Risk (Flags Detected)';
    } else if (safeScore < 88) {
      status = 'moderate';
      badgeClass = 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      label = 'Moderate Credibility (Needs Substantiation)';
    }

    return {
      score: safeScore,
      status,
      badgeClass,
      label,
      anachronisms,
      substantiation,
      metricFlags,
      timelineFlags,
      ghostPhrases,
      totalFlags: anachronisms.length + metricFlags.length + timelineFlags.length + (substantiation.ratio < 60 ? 1 : 0)
    };
  }

  /**
   * 7. Generates HTML Report for the Integrity Audit Modal
   */
  function renderIntegrityReportHtml(audit) {
    if (!audit) return '';

    const flagsHtml = [];

    // Anachronisms
    if (audit.anachronisms.length > 0) {
      audit.anachronisms.forEach(a => {
        flagsHtml.push(`
          <div class="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-1">
            <div class="flex items-center space-x-2 text-rose-500 font-bold text-xs">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Tech Timeline Anachronism</span>
            </div>
            <p class="text-xs opacity-90 leading-relaxed">${a.message}</p>
          </div>
        `);
      });
    }

    // Buzzword Stuffing
    if (audit.substantiation.listedCount >= 5 && audit.substantiation.ratio < 60) {
      flagsHtml.push(`
        <div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
          <div class="flex items-center space-x-2 text-amber-500 font-bold text-xs">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Unsubstantiated Keywords (${audit.substantiation.ratio}% Evidenced)</span>
          </div>
          <p class="text-xs opacity-90 leading-relaxed">
            The following skills are listed in your skills block but never appear in work history projects: 
            <strong>${audit.substantiation.unbackedSkills.slice(0, 5).join(', ')}</strong>.
          </p>
        </div>
      `);
    }

    // Metric flags
    if (audit.metricFlags.length > 0) {
      audit.metricFlags.forEach(m => {
        flagsHtml.push(`
          <div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
            <div class="flex items-center space-x-2 text-amber-500 font-bold text-xs">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span>Metric Plausibility Warning</span>
            </div>
            <p class="text-xs opacity-90 leading-relaxed">${m.message}</p>
          </div>
        `);
      });
    }

    // Timeline clashes
    if (audit.timelineFlags.length > 0) {
      audit.timelineFlags.forEach(t => {
        flagsHtml.push(`
          <div class="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-1">
            <div class="flex items-center space-x-2 text-rose-500 font-bold text-xs">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Seniority / Timeline Contradiction</span>
            </div>
            <p class="text-xs opacity-90 leading-relaxed">${t.message}</p>
          </div>
        `);
      });
    }

    // Clean pass if no flags
    if (flagsHtml.length === 0) {
      flagsHtml.push(`
        <div class="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span class="text-xs font-semibold">Zero critical credibility anomalies detected. Claims appear truthful, substantiated, and aligned with industry norms.</span>
        </div>
      `);
    }

    return `
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 rounded-xl border" style="background: var(--paper-2); border-color: var(--border);">
          <div class="space-y-1">
            <span class="text-xs font-mono opacity-70 uppercase tracking-wider">Integrity Audit Verdict</span>
            <h4 class="text-base font-bold" style="color: var(--ink);">${audit.label}</h4>
            <span class="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${audit.badgeClass}">
              ${audit.totalFlags} Anomaly Flag${audit.totalFlags === 1 ? '' : 's'}
            </span>
          </div>
          <div class="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-2xl shadow-md ${audit.badgeClass}">
            <span>${audit.score}</span>
            <span class="text-[9px] font-bold uppercase tracking-wider">Score</span>
          </div>
        </div>

        <div class="space-y-2.5">
          <h5 class="text-xs font-bold uppercase tracking-wider" style="color: var(--ink);">Forensic Findings</h5>
          <div class="space-y-2">${flagsHtml.join('')}</div>
        </div>
      </div>
    `;
  }

  return {
    TECH_BIRTH_YEARS,
    PASSIVE_GHOST_PHRASES,
    checkTechAnachronisms,
    checkSkillsSubstantiation,
    checkMetricPlausibility,
    checkTimelineSeniority,
    checkGhostPhrases,
    auditResumeIntegrity,
    renderIntegrityReportHtml
  };
}));

