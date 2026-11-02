/**
 * SkillSync - 1-Click Speedrun Application Kit & Match Radar Engine
 * File: assets/js/modules/speedrun.js
 *
 * Universal UMD module for hyper-efficient job application workflows:
 * 1. 1-Click Speedrun Application Kit (Tailored Resume + Cover Letter + Outreach DM + Kanban Entry)
 * 2. Auto-Match Radar (Batch ATS Pre-Scoring across job listings with live fit percentages)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncSpeedrun = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TECH_TAXONOMY = [
    'react', 'next.js', 'vue', 'angular', 'svelte', 'typescript', 'javascript',
    'tailwind', 'css', 'node.js', 'express', 'python', 'fastapi', 'django',
    'go', 'rust', 'c++', 'java', 'postgresql', 'mysql', 'mongodb', 'redis',
    'docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure', 'ci/cd',
    'graphql', 'rest api', 'kafka', 'playwright', 'jest', 'linux', 'git'
  ];

  /**
   * Fast skill extractor for candidate and job texts
   */
  function extractSkills(text = '') {
    if (!text || typeof text !== 'string') return [];
    const lower = text.toLowerCase();
    return TECH_TAXONOMY.filter(skill => {
      const esc = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('(?:^|[\\s,;:.()/\\[\\]])' + esc + '(?:$|[\\s,;:.()/\\[\\]])', 'i');
      return regex.test(lower);
    });
  }

  /**
   * Generates a 3-bullet XYZ tailored resume enhancement
   */
  function generateTailoredBullets(company = 'Tech Co', role = 'Software Engineer', missingSkills = []) {
    const gaps = Array.isArray(missingSkills) && missingSkills.length > 0
      ? missingSkills
      : ['Distributed Caching', 'Cloud Automation', 'API Performance'];

    const g1 = gaps[0] || 'High-Concurrency Architecture';
    const g2 = gaps[1] || 'Container Orchestration';
    const g3 = gaps[2] || 'System Reliability';

    return [
      {
        skill: g1,
        bullet: `Architected and shipped an event-driven data pipeline leveraging ${g1}, reducing p99 API latency by 42% across 18,000 requests/sec.`,
        impact: '42% latency reduction under heavy concurrent load'
      },
      {
        skill: g2,
        bullet: `Modernized core deployment workflows utilizing ${g2}, improving daily deployment frequency by 3.5x while sustaining 99.98% platform uptime.`,
        impact: '3.5x deployment frequency increase'
      },
      {
        skill: g3,
        bullet: `Instrumented automated end-to-end telemetry and resilience policies around ${g3}, eliminating recurring downtime and cutting mean-time-to-recovery (MTTR) by 55%.`,
        impact: '55% reduction in MTTR'
      }
    ];
  }

  /**
   * Integrates tailored bullets into a candidate's base resume text
   */
  function formatSpeedrunResume(baseResume = '', tailoredBullets = []) {
    const resume = String(baseResume || '').trim();
    const bullets = Array.isArray(tailoredBullets) ? tailoredBullets : [];
    if (bullets.length === 0) return resume;

    const bulletBlock = bullets.map(b => {
      const text = (typeof b === 'object' && b !== null && b.bullet) ? b.bullet : String(b);
      return `• ${text}`;
    }).join('\n');
    const headerBlock = `\n\n[ATS TARGETED HIGHLIGHTS & QUANTIFIED ACHIEVEMENTS]\n${bulletBlock}\n`;

    // Try inserting right after the first Experience section or append to top
    if (/experience|professional history|work history/i.test(resume)) {
      return resume.replace(/(experience|professional history|work history)/i, `$1${headerBlock}`);
    }

    return `${resume}\n${headerBlock}`;
  }

  /**
   * Generates a concise, high-converting cover letter
   */
  function generateSpeedrunCoverLetter(company = 'Tech Company', role = 'Software Engineer', candidateSkills = []) {
    const skillsList = candidateSkills.slice(0, 4).join(', ') || 'modern cloud architecture, scalable APIs, and performance optimization';

    return `Dear Hiring Team at ${company},

I am writing to express my strong enthusiasm for the ${role} position. With a proven engineering track record designing resilient systems with ${skillsList}, I am confident in my ability to immediately accelerate your team's roadmap.

Throughout my experience, I have focused on delivering measurable engineering impact—architecting low-latency microservices, automating reliable deployment pipelines, and ensuring high platform availability. Your team's work at ${company} directly aligns with my passion for pragmatic system design and continuous technical bar-raising.

I welcome the opportunity to discuss how my technical expertise can support ${company}'s upcoming milestones. Thank you for your time and consideration.

Sincerely,
Candidate`;
  }

  /**
   * Generates a high-conversion LinkedIn connection note (<300 characters)
   */
  function generateSpeedrunOutreach(company = 'Tech Co', role = 'Software Engineer', topSkill = 'Cloud Architecture') {
    const note = `Hi! I recently applied for the ${role} opening at ${company}. Having architected scalable systems with ${topSkill} and cut latency by 40%+, I'd love to connect and follow your team's engineering milestones. Cheers!`;
    return note.length > 295 ? note.slice(0, 292) + '...' : note;
  }

  /**
   * Compiles the complete 1-Click Speedrun Application Kit
   */
  function generateSpeedrunKit(options = {}) {
    const resume = String(options.resume || '').trim();
    const company = String(options.company_name || options.company || 'Tech Company').trim();
    const role = String(options.job_title || options.role || 'Software Engineer').trim();
    const jobDesc = String(options.job_description || options.description || '').trim();

    // Extract skills
    const candidateSkills = extractSkills(resume);
    const jobSkills = Array.from(new Set([...extractSkills(jobDesc), ...(options.tags || [])]));
    const missingSkills = options.missing_skills || jobSkills.filter(s => !candidateSkills.map(c => c.toLowerCase()).includes(s.toLowerCase()));

    // 1. Tailored Bullets & Resume
    const tailoredBullets = generateTailoredBullets(company, role, missingSkills);
    const tailoredResume = formatSpeedrunResume(resume, tailoredBullets);

    // 2. Cover Letter
    const coverLetter = generateSpeedrunCoverLetter(company, role, candidateSkills.length > 0 ? candidateSkills : jobSkills);

    // 3. Outreach DM
    const outreachDm = generateSpeedrunOutreach(company, role, jobSkills[0] || candidateSkills[0] || 'System Architecture');

    // 4. Kanban Pipeline Record
    const pipelineRecord = {
      id: `pipeline-sr-${Date.now()}`,
      company: company,
      role: role,
      salary: options.salary || 'Competitive',
      date_applied: new Date().toISOString().split('T')[0],
      status: 'Applied',
      followup_due_days: 5,
      notes: `Speedrun Kit generated with ${tailoredBullets.length} targeted XYZ bullets for ${missingSkills.slice(0, 2).join(', ') || 'stack'}.`
    };

    return {
      company,
      role,
      candidate_skills: candidateSkills,
      job_skills: jobSkills,
      missing_skills: missingSkills,
      tailored_bullets: tailoredBullets,
      tailored_resume: tailoredResume,
      cover_letter: coverLetter,
      outreach_dm: outreachDm,
      pipeline_record: pipelineRecord
    };
  }

  /**
   * Batch calculates ATS match scores across a list of job listings (Match Radar)
   */
  function calculateMatchRadar(candidateResume = '', jobsList = []) {
    if (!Array.isArray(jobsList)) return [];
    const candidateSkills = extractSkills(candidateResume);
    const candidateSet = new Set(candidateSkills.map(s => s.toLowerCase()));

    return jobsList.map(job => {
      const explicitTags = Array.isArray(job.tags) ? job.tags : [];
      const descSkills = extractSkills(job.description || '');
      const allRequired = Array.from(new Set([...explicitTags, ...descSkills]));

      if (allRequired.length === 0) {
        const score = candidateSkills.length > 0 ? 82 : 70;
        return {
          ...job,
          match_score: score,
          matchScore: score,
          match_tier: 'Strong Match',
          matchTier: 'Strong Match',
          matchBadgeText: `${score}% Fit · Strong Match`,
          matchBadgeClass: 'chip-match-high',
          matched_skills: candidateSkills.slice(0, 3),
          matchedSkills: candidateSkills.slice(0, 3),
          missing_skills: [],
          missingSkills: []
        };
      }

      const matched = [];
      const missing = [];

      allRequired.forEach(req => {
        const norm = String(req).toLowerCase().trim();
        if (candidateSet.has(norm)) {
          matched.push(req);
        } else {
          missing.push(req);
        }
      });

      // Calculate score with reasonable baseline
      let score = Math.round((matched.length / allRequired.length) * 100);
      if (candidateSkills.length > 0 && matched.length > 0) {
        score = Math.min(98, Math.max(score, Math.round(50 + (matched.length * 12))));
      } else if (candidateSkills.length === 0) {
        score = 65; // neutral baseline when no resume uploaded
      }

      let tier = 'Needs Growth';
      let badgeClass = 'chip-match-reach';
      if (score >= 78) {
        tier = 'Strong Match';
        badgeClass = 'chip-match-high';
      } else if (score >= 55) {
        tier = 'Moderate Match';
        badgeClass = 'chip-match-mid';
      }

      return {
        ...job,
        match_score: score,
        matchScore: score,
        match_tier: tier,
        matchTier: tier,
        matchBadgeText: `${score}% Fit · ${tier}`,
        matchBadgeClass: badgeClass,
        matched_skills: matched,
        matchedSkills: matched,
        missing_skills: missing,
        missingSkills: missing
      };
    });
  }

  /**
   * Sorts jobs by match fitness (highest ATS compatibility first)
   */
  function sortJobsByMatchFit(jobsList = [], candidateResume = '') {
    const radar = calculateMatchRadar(candidateResume, jobsList);
    return [...radar].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }

  /**
   * Filters jobs meeting a minimum match score threshold (default 75%)
   */
  function filterHighMatchJobs(jobsList = [], candidateResume = '', minScore = 75) {
    const radar = calculateMatchRadar(candidateResume, jobsList);
    return radar.filter(j => (j.match_score || 0) >= minScore);
  }

  return {
    TECH_TAXONOMY,
    extractSkills,
    generateTailoredBullets,
    formatSpeedrunResume,
    generateSpeedrunCoverLetter,
    generateSpeedrunOutreach,
    generateSpeedrunKit,
    calculateMatchRadar,
    sortJobsByMatchFit,
    filterHighMatchJobs
  };
});
