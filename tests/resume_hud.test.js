/**
 * @file tests/resume_hud.test.js
 * Comprehensive unit test suite for the Live Resume Health HUD Engine
 */

const SkillSyncResumeHud = require('../assets/js/modules/resume_hud.js');

describe('Live Resume Health HUD & Action Verb Analysis Test Suite', () => {
  const sampleStrongResume = `
    Jane Doe - Senior Distributed Systems Architect
    • Architected and deployed an asynchronous processing engine reducing API p99 latency by 45%.
    • Spearheaded cloud migration on AWS saving $120k annually across 14 microservices.
    • Optimized PostgreSQL database indexing improving query throughput by 3.5x.
    • Automated CI/CD deployment pipelines with Docker and GitHub Actions.
  `;

  const sampleWeakResume = `
    John Smith - Junior Web Developer
    • Helped with website maintenance.
    • Worked on fixing bug issues.
    • Responsible for updating CSS styling.
  `;

  test('analyzeResumeHealth extracts metrics and power verbs from strong resume', () => {
    const analysis = SkillSyncResumeHud.analyzeResumeHealth(sampleStrongResume);

    expect(analysis.metricCount).toBeGreaterThanOrEqual(3);
    expect(analysis.powerCount).toBeGreaterThanOrEqual(4);
    expect(analysis.powerVerbs).toContain('architected');
    expect(analysis.powerVerbs).toContain('spearheaded');
    expect(analysis.score).toBeGreaterThanOrEqual(75);
    expect(analysis.weakVerbs.length).toBe(0);
  });

  test('analyzeResumeHealth identifies weak passive verbs and suggests replacements', () => {
    const analysis = SkillSyncResumeHud.analyzeResumeHealth(sampleWeakResume);

    expect(analysis.weakVerbs.length).toBeGreaterThanOrEqual(2);
    const words = analysis.weakVerbs.map(w => w.word);
    expect(words).toContain('helped');
    expect(words).toContain('worked on');
    expect(analysis.metricCount).toBe(0);
    expect(analysis.score).toBeLessThan(65);
  });

  test('analyzeResumeHealth handles empty or whitespace text gracefully', () => {
    const analysis = SkillSyncResumeHud.analyzeResumeHealth('');

    expect(analysis.charCount).toBe(0);
    expect(analysis.wordCount).toBe(0);
    expect(analysis.metricCount).toBe(0);
    expect(analysis.powerCount).toBe(0);
    expect(analysis.weakVerbs.length).toBe(0);
  });

  test('renderResumeHudHtml formats health score and badges correctly', () => {
    const analysis = SkillSyncResumeHud.analyzeResumeHealth(sampleStrongResume);
    const html = SkillSyncResumeHud.renderResumeHudHtml(analysis);

    expect(html).toContain('Resume Health:');
    expect(html).toContain('Power Verb');
    expect(html).toContain('Metric');
  });
});

// Percentages followed by whitespace must count as metrics, not disappear at a word boundary.
test('recognizes percentage accomplishments in normal resume sentences', () => {
  expect(SkillSyncResumeHud.analyzeResumeHealth('Reduced API latency by 35% and raised conversion by 12.5%.').metricCount).toBe(2);
});
