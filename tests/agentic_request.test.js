/**
 * @file tests/agentic_request.test.js
 * Unit test suite for 1-Click Agentic AI Company Application & Request Dispatcher
 */

const SkillSyncAgenticRequest = require('../assets/js/modules/agentic_request.js');

describe('1-Click Agentic AI Company Request Engine Test Suite', () => {
  const sampleResume = `
    Alex Mercer - Senior Software Engineer
    Skills: React, Node.js, TypeScript, PostgreSQL, Docker, AWS, Kubernetes
    Experience:
    Senior Software Engineer at Horizon Labs (2021 - Present)
    • Architected distributed services on AWS and Kubernetes.
    • Optimized PostgreSQL query execution by 42%.
  `;

  const sampleJob = `
    Senior Cloud Platform Engineer at Nexus Robotics
    We are looking for an experienced engineer to scale our distributed systems.
    Required skills: Kubernetes, Docker, Node.js, AWS, PostgreSQL, Go.
  `;

  test('parseTargetEntity accurately extracts company and role', () => {
    const entity = SkillSyncAgenticRequest.parseTargetEntity(sampleJob);
    expect(entity.company).toBe('Nexus Robotics');
    expect(entity.role).toBe('Senior Cloud Platform Engineer');
  });

  test('generateAgenticCompanyRequest builds full autonomous company application request', () => {
    const request = SkillSyncAgenticRequest.generateAgenticCompanyRequest({
      resume: sampleResume,
      jobText: sampleJob,
      company: 'Nexus Robotics',
      role: 'Senior Cloud Platform Engineer'
    });

    expect(request).toBeDefined();
    expect(request.company).toBe('Nexus Robotics');
    expect(request.role).toBe('Senior Cloud Platform Engineer');
    expect(request.trackingId).toMatch(/^REQ-/);
    expect(Array.isArray(request.agentPlan)).toBe(true);
    expect(request.agentPlan.length).toBeGreaterThanOrEqual(3);
    expect(typeof request.executiveRequestLetter).toBe('string');
    expect(request.executiveRequestLetter).toContain('Nexus Robotics');
    expect(request.executiveRequestLetter).toContain('Senior Cloud Platform Engineer');
    expect(typeof request.directDm).toBe('string');
    expect(request.directDm.length).toBeLessThanOrEqual(300);
    expect(request.mailtoUri).toContain('mailto:');
    expect(request.is_ready).toBe(true);
  });

  test('dispatchCompanyRequest creates valid dispatch receipt and pipeline entry', () => {
    const request = SkillSyncAgenticRequest.generateAgenticCompanyRequest({
      resume: sampleResume,
      jobText: sampleJob,
      company: 'Nexus Robotics',
      role: 'Senior Cloud Platform Engineer'
    });

    const receipt = SkillSyncAgenticRequest.dispatchCompanyRequest(request);
    expect(receipt.success).toBe(true);
    expect(receipt.trackingId).toBe(request.trackingId);
    expect(receipt.status).toBe('Dispatched via Agentic AI');
    expect(receipt.pipelineRecord.status).toBe('applied');
    expect(receipt.pipelineRecord.company).toBe('Nexus Robotics');
  });

  describe('UI Integration & Toolkit Replacement Verification', () => {
    const fs = require('fs');
    const path = require('path');
    const appHtml = fs.readFileSync(path.resolve(__dirname, '../app.html'), 'utf8');

    test('the workspace keeps focused application tools without dispatch controls', () => {
      expect(appHtml).toContain('id="tailorResumeBtn"');
      expect(appHtml).toContain('id="generateCoverLetterBtn"');
      expect(appHtml).toContain('id="interviewPrepBtn"');
      expect(appHtml).not.toContain('id="agenticCompanyRequestBtn"');
      expect(appHtml).not.toContain('id="dispatchCompanyRequestBtn"');
    });

    test('removed tool modals are not shipped in the workspace', () => {
      expect(appHtml).not.toContain('id="agentic-request-modal"');
      expect(appHtml).not.toContain('id="salary-modal"');
      expect(appHtml).not.toContain('id="dossier-modal"');
      expect(appHtml).not.toContain('id="outreach-modal"');
      expect(appHtml).toContain('id="tabSyntheticQuestionsBtn"');
    });
  });
});
