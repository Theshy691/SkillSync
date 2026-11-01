/**
 * SkillSync - LinkedIn Outreach & Cold Messaging Generator
 * File: assets/js/modules/outreach.js
 *
 * Universal UMD module for generating high-conversion, professional networking
 * drafts tailored for LinkedIn connection requests, InMail, and coffee chats.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncOutreach = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OUTREACH_LIMITS = {
    connect: 300,
    inmail: 2000,
    coffee: 1000
  };

  function getOutreachLimit(type) {
    return OUTREACH_LIMITS[type] || 300;
  }

  function calculateCounterStatus(length, limit = 300) {
    const len = Number(length) || 0;
    const max = Number(limit) || 300;
    const warningThreshold = Math.floor(max * 0.85);

    if (len > max) {
      return { status: 'overflow', colorClass: 'text-rose-500 font-semibold' };
    }
    if (len > warningThreshold) {
      return { status: 'warning', colorClass: 'text-amber-500' };
    }
    return { status: 'normal', colorClass: 'text-emerald-500' };
  }

  function generateOutreachDrafts(info = {}, extraOptions = {}) {
    let company = 'Target Company';
    let title = 'Software Engineer';
    let topSkills = ['Full-Stack', 'Distributed Systems'];

    if (typeof info === 'string') {
      company = info.trim() || 'Target Company';
    } else if (info && typeof info === 'object') {
      company = info.company || info.companyName || 'Target Company';
      title = info.title || info.roleTitle || 'Software Engineer';
      if (Array.isArray(info.skills) && info.skills.length > 0) {
        topSkills = info.skills;
      }
    }

    if (Array.isArray(extraOptions.vaultSkills) && extraOptions.vaultSkills.length > 0) {
      topSkills = extraOptions.vaultSkills.slice(0, 3).map(s => String(s).charAt(0).toUpperCase() + String(s).slice(1));
    }

    const skillsSnippet = topSkills.slice(0, 2).join(' & ');

    const connect = `Hi! I noticed your work building engineering solutions at ${company}. As a ${title} skilled in ${skillsSnippet}, I'd love to connect and follow ${company}'s technical growth!`;

    const inmail = `Hi [Hiring Manager],\n\nI've been following ${company}'s product updates and noticed your open ${title} position. With a strong track record delivering scalable systems using ${topSkills.join(', ')}, I specialize in shipping high-reliability features and optimizing developer velocity.\n\nI'd welcome the chance to discuss how my technical background aligns with your roadmap. Would you be open to a 10-minute chat this week?\n\nBest regards,\n[Your Name]`;

    const coffee = `Hi [Name],\n\nI came across your profile while researching engineering culture at ${company}. As an engineer working with ${skillsSnippet}, I really admire the architecture and challenges your team is tackling.\n\nIf your schedule allows, I'd love to buy you a virtual coffee for 15 minutes to hear about your experience on the team.\n\nCheers!`;

    return {
      connect,
      inmail,
      coffee,
      company,
      title
    };
  }

  return {
    OUTREACH_LIMITS,
    getOutreachLimit,
    calculateCounterStatus,
    generateOutreachDrafts
  };
});
