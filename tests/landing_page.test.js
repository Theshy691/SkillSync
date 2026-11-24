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

  test('app.html no longer ships mock telemetry alongside the real workspace', () => {
    expect(appHtml).not.toContain('Evaluation Simulation');
    expect(appHtml).toContain('id="workspaceMode"');
    expect(appHtml).not.toContain('Verified Candidate Fit');
  });
});


describe('Landing page motion', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../assets/js/landing_motion.js'), 'utf8');
  let originalMatchMedia;
  let originalObserver;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalObserver = window.IntersectionObserver;
    document.body.innerHTML = '<div data-landing-motion></div><ol data-landing-motion></ol>';
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.IntersectionObserver = originalObserver;
    document.body.replaceChildren();
  });

  test('plays each sequence once when it enters the viewport', () => {
    const observe = jest.fn();
    const unobserve = jest.fn();
    let onIntersection;
    window.matchMedia = () => ({ matches: true });
    window.IntersectionObserver = jest.fn(callback => {
      onIntersection = callback;
      return { observe, unobserve };
    });
    window.eval(source);

    const [report, steps] = document.querySelectorAll('[data-landing-motion]');
    expect(observe.mock.calls).toEqual([[report], [steps]]);
    onIntersection([{ target: report, isIntersecting: true }, { target: steps, isIntersecting: false }]);
    expect(report.classList.contains('is-in-view')).toBe(true);
    expect(steps.classList.contains('is-in-view')).toBe(false);
    expect(unobserve.mock.calls).toEqual([[report]]);
  });

  test('keeps content in its default state for reduced motion', () => {
    window.matchMedia = () => ({ matches: false });
    window.IntersectionObserver = jest.fn();
    window.eval(source);

    expect(window.IntersectionObserver).not.toHaveBeenCalled();
    expect(document.querySelector('.is-in-view')).toBeNull();
  });
});

test('the sample role picker updates the report even with reduced motion', () => {
  const originalMatchMedia = window.matchMedia;
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const source = fs.readFileSync(path.resolve(__dirname, '../assets/js/landing_motion.js'), 'utf8');
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  window.matchMedia = () => ({ matches: false });
  try {
    window.eval(source);
    const picker = document.getElementById('sampleRolePicker');
    const [fullStack, backend] = picker.querySelectorAll('button');
    expect(picker.hidden).toBe(false);
    backend.click();
    expect(backend.getAttribute('aria-pressed')).toBe('true');
    expect(fullStack.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('heroRoleVal').textContent).toBe('Backend Engineer');
    expect(document.getElementById('sampleRoleStatus').textContent).toContain('Terraform');
    expect(document.querySelector('.comparison-preview').classList.contains('is-in-view')).toBe(false);
    fullStack.click();
    expect(document.getElementById('heroRoleVal').textContent).toBe('Full-Stack Engineer');
    expect(document.getElementById('heroGapVal').textContent).toBe('Kubernetes');
  } finally {
    window.matchMedia = originalMatchMedia;
    document.body.replaceChildren();
  }
});
