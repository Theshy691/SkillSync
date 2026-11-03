/**
 * SkillSync - Truthful Marketing & Landing Page Integrity Test Suite
 * File: tests/landing_page.test.js
 *
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Landing Page Truthfulness & Zero Fake Reviews Integrity', () => {
  let indexHtml;
  let appHtml;
  let jobsHtml;
  let designMd;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    appHtml = fs.readFileSync(path.resolve(__dirname, '../app.html'), 'utf8');
    jobsHtml = fs.readFileSync(path.resolve(__dirname, '../jobs.html'), 'utf8');
    designMd = fs.readFileSync(path.resolve(__dirname, '../DESIGN.md'), 'utf8');
  });

  test('index.html contains zero fabricated vanity counter numbers', () => {
    // Assert absence of fake vanity counts
    expect(indexHtml).not.toContain('14,800+');
    expect(indexHtml).not.toContain('14,820+');
    expect(indexHtml).not.toContain('450k+');
    expect(indexHtml).not.toContain('450,000+');
    expect(indexHtml).not.toContain('8,200+');
    expect(indexHtml).not.toContain('92% Interview Rate');
    expect(indexHtml).not.toContain('hero-stats');
  });

  test('landing-page.js contains no fake interval counters or artificial streak generators', () => {
    const landingJs = fs.readFileSync(path.resolve(__dirname, '../assets/js/landing-page.js'), 'utf8');
    expect(landingJs).not.toContain('14820');
    expect(landingJs).not.toContain('450000');
    expect(landingJs).not.toContain('8200');
    expect(landingJs).not.toContain('buildStreakGrid');
    expect(landingJs).not.toContain('activeDays');
  });

  test('all files have zero legacy template references to FortiFocus', () => {
    expect(indexHtml.toLowerCase()).not.toContain('fortifocus');
    expect(appHtml.toLowerCase()).not.toContain('fortifocus');
    expect(jobsHtml.toLowerCase()).not.toContain('fortifocus');
    expect(designMd.toLowerCase()).not.toContain('fortifocus');
  });

  test('app.html transparently labels mock telemetry as simulation preview', () => {
    expect(appHtml).toContain('Evaluation Simulation');
    expect(appHtml).not.toContain('Verified Candidate Fit');
  });
});

