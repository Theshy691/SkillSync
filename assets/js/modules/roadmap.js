/**
 * SkillSync - 2-Week Skill Bridge Learning Roadmap Engine
 * File: assets/js/modules/roadmap.js
 *
 * Universal UMD module for compiling personalized 14-day technical learning
 * roadmaps based on resume keyword gaps and job requirements.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncRoadmap = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function generateRoadmapCurriculum(missingSkills = []) {
    const skills = (Array.isArray(missingSkills) && missingSkills.length > 0)
      ? missingSkills.map(s => String(s).trim()).filter(Boolean)
      : ['System Architecture', 'Modern Cloud / DevOps', 'API Optimization'];

    const primarySkill = skills[0] || 'Technical Specialization';
    const secondarySkill = skills[1] || primarySkill;
    const tertiarySkill = skills[2] || secondarySkill;

    const milestones = [
      {
        id: 'milestone_1',
        dayRange: 'Days 1–2',
        skill: primarySkill,
        title: `${primarySkill}: Core Mental Model & Syntax Foundations`,
        objective: `Master the foundational paradigm, project bootstrapping, and architectural primitives of ${primarySkill}.`,
        hours: '4 hrs',
        docsUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(primarySkill)}`
      },
      {
        id: 'milestone_2',
        dayRange: 'Days 3–5',
        skill: primarySkill,
        title: `${primarySkill}: Idiomatic Patterns & Production APIs`,
        objective: `Implement state management, error boundaries, and concurrency/asynchronous workflows in ${primarySkill}.`,
        hours: '6 hrs',
        docsUrl: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(primarySkill)}`
      },
      {
        id: 'milestone_3',
        dayRange: 'Days 6–7',
        skill: secondarySkill,
        title: `${secondarySkill}: Tooling & Verification Pipeline`,
        objective: `Write unit and integration suites targeting 85%+ coverage, plus automated linting and pre-commit hooks for ${secondarySkill}.`,
        hours: '5 hrs',
        docsUrl: `https://www.google.com/search?q=${encodeURIComponent(secondarySkill + ' best practices')}`
      },
      {
        id: 'milestone_4',
        dayRange: 'Days 8–10',
        skill: secondarySkill,
        title: `${secondarySkill}: Performance Tuning & Scalability`,
        objective: `Benchmark throughput, profile memory allocations, diagnose bottlenecks, and implement indexing/caching in ${secondarySkill}.`,
        hours: '6 hrs',
        docsUrl: `https://www.google.com/search?q=${encodeURIComponent(secondarySkill + ' performance optimization')}`
      },
      {
        id: 'milestone_5',
        dayRange: 'Days 11–12',
        skill: tertiarySkill,
        title: `${tertiarySkill}: Infrastructure, Security & Containerization`,
        objective: `Dockerize the application, configure non-root security contexts, env secrets management, and automated CI/CD stages.`,
        hours: '5 hrs',
        docsUrl: `https://www.google.com/search?q=${encodeURIComponent(tertiarySkill + ' security hardening')}`
      },
      {
        id: 'milestone_6',
        dayRange: 'Days 13–14',
        skill: primarySkill,
        title: `Full-Stack Capstone Proof-of-Concept & Portfolio Demo`,
        objective: `Synthesize ${primarySkill} and ${secondarySkill} into a production-grade mini-project deployed with live telemetry.`,
        hours: '8 hrs',
        docsUrl: `https://github.com/topics/${encodeURIComponent(primarySkill.toLowerCase().replace(/[^a-z0-9]/g, ''))}`
      }
    ];

    return milestones;
  }

  function calculateRoadmapProgress(milestones = [], completedMap = {}) {
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return { total: 0, completed: 0, percent: 0, label: '0 / 0 Milestones (0%)' };
    }

    const total = milestones.length;
    let completed = 0;
    milestones.forEach(m => {
      if (completedMap && completedMap[m.id]) {
        completed += 1;
      }
    });

    const percent = Math.round((completed / total) * 100);
    return {
      total,
      completed,
      percent,
      label: `${completed} / ${total} Milestones (${percent}%)`
    };
  }

  return {
    generateRoadmapCurriculum,
    calculateRoadmapProgress
  };
});
