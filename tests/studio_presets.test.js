/**
 * SkillSync - Dual-Pane ATS Studio Presets & Clean Sign-Out Test Suite
 * File: tests/studio_presets.test.js
 *
 * @jest-environment jsdom
 */

const { initStudioPresets, performSignOut } = require('../script.js');

describe('Dual-Pane ATS Input Studio Presets & Clean Workspace State', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="resumeDropZone" class="studio-pane">
        <select id="resumeVersionSelect"></select>
        <button id="sampleResumeSweBtn"></button>
        <button id="sampleResumeDevOpsBtn"></button>
        <button id="clearResumeBtn"></button>
        <textarea id="resumeText"></textarea>
        <span id="resumeCount">0 chars</span>
      </div>
      <div class="studio-pane">
        <input type="url" id="jobUrlInput">
        <button id="sampleJobSweBtn"></button>
        <button id="sampleJobDevOpsBtn"></button>
        <button id="clearJobBtn"></button>
        <textarea id="jobText"></textarea>
        <span id="jobCount">0 chars</span>
      </div>
      <div id="toastContainer"></div>
    `;
    localStorage.clear();
  });

  test('clicking sampleResumeSweBtn populates Full-Stack Lead resume and updates counter', () => {
    initStudioPresets();
    const btn = document.getElementById('sampleResumeSweBtn');
    const resumeText = document.getElementById('resumeText');
    const resumeCount = document.getElementById('resumeCount');

    btn.click();
    expect(resumeText.value).toContain('Full-Stack Software Engineer');
    expect(resumeText.value).toContain('React, Next.js, Node.js');
    expect(resumeCount.textContent).not.toBe('0 chars');
  });

  test('clicking sampleResumeDevOpsBtn populates Cloud / DevOps resume and updates counter', () => {
    initStudioPresets();
    const btn = document.getElementById('sampleResumeDevOpsBtn');
    const resumeText = document.getElementById('resumeText');
    const resumeCount = document.getElementById('resumeCount');

    btn.click();
    expect(resumeText.value).toContain('Senior Cloud & Platform Engineer');
    expect(resumeText.value).toContain('Kubernetes, Docker, Terraform');
    expect(resumeCount.textContent).not.toBe('0 chars');
  });

  test('clicking clearResumeBtn clears resume textarea and resets counter to 0 chars', () => {
    initStudioPresets();
    const resumeText = document.getElementById('resumeText');
    const resumeCount = document.getElementById('resumeCount');
    const clearBtn = document.getElementById('clearResumeBtn');

    resumeText.value = 'Existing candidate resume content';
    clearBtn.click();
    expect(resumeText.value).toBe('');
    expect(resumeCount.textContent).toBe('0 chars');
  });

  test('clicking sampleJobSweBtn populates Stripe Staff SWE target role', () => {
    initStudioPresets();
    const btn = document.getElementById('sampleJobSweBtn');
    const jobText = document.getElementById('jobText');
    const jobCount = document.getElementById('jobCount');

    btn.click();
    expect(jobText.value).toContain('Staff Full-Stack Software Engineer');
    expect(jobText.value).toContain('payments infrastructure');
    expect(jobCount.textContent).not.toBe('0 chars');
  });

  test('clicking sampleJobDevOpsBtn populates Datadog Lead SRE target role', () => {
    initStudioPresets();
    const btn = document.getElementById('sampleJobDevOpsBtn');
    const jobText = document.getElementById('jobText');
    const jobCount = document.getElementById('jobCount');

    btn.click();
    expect(jobText.value).toContain('Lead SRE / Cloud Platform Engineer');
    expect(jobText.value).toContain('telemetry clusters');
    expect(jobCount.textContent).not.toBe('0 chars');
  });

  test('clicking clearJobBtn clears job textarea and resets counter to 0 chars', () => {
    initStudioPresets();
    const jobText = document.getElementById('jobText');
    const jobCount = document.getElementById('jobCount');
    const clearBtn = document.getElementById('clearJobBtn');

    jobText.value = 'Existing target job posting';
    clearBtn.click();
    expect(jobText.value).toBe('');
    expect(jobCount.textContent).toBe('0 chars');
  });

  test('performSignOut clears resume and job textareas and purges cached profile', async () => {
    const resumeText = document.getElementById('resumeText');
    const jobText = document.getElementById('jobText');
    const resumeCount = document.getElementById('resumeCount');
    const jobCount = document.getElementById('jobCount');

    resumeText.value = 'Secret User Resume';
    jobText.value = 'Secret Job Role';
    localStorage.setItem('skillsync_resume_versions', JSON.stringify([{ id: '1', content: 'test' }]));
    localStorage.setItem('skillsync_cached_profile', 'profile data');

    await performSignOut();

    expect(resumeText.value).toBe('');
    expect(jobText.value).toBe('');
    expect(resumeCount.textContent).toBe('0 chars');
    expect(jobCount.textContent).toBe('0 chars');
    expect(localStorage.getItem('skillsync_resume_versions')).toBeNull();
    expect(localStorage.getItem('skillsync_cached_profile')).toBeNull();
  });
});
