/**
 * @file tests/speedrun.test.js
 * Comprehensive unit test suite for the 1-Click Speedrun Application Kit Engine
 */

const SkillSyncSpeedrun = require('../assets/js/modules/speedrun.js');

describe('1-Click Speedrun Application Kit Engine Test Suite', () => {
  const sampleCandidateResume = `
    Jane Doe - Senior Full Stack Engineer
    Skills: React, Node.js, TypeScript, PostgreSQL, AWS, Docker, GraphQL
    Experience:
    Senior Software Engineer at Alpha Tech (2021 - Present)
    • Designed and deployed scalable microservices on AWS and Docker.
    • Architected responsive frontend applications using React and TypeScript.
    • Managed PostgreSQL databases, writing optimized queries and migrations.
  `;

  const sampleTargetJob = {
    title: 'Senior Cloud Platform Engineer',
    company: 'Nexus Robotics',
    description: `
      Nexus Robotics is looking for a Senior Cloud Platform Engineer to lead infrastructure scaling.
      Requirements:
      - 5+ years experience with Kubernetes, Go, Python, and CI/CD pipelines
      - Expertise with AWS, Docker, and distributed microservices
      - Experience monitoring production systems and optimizing latency
    `,
    salary: '$140,000 - $175,000',
    location: 'Remote (US/Worldwide)'
  };

  test('generateSpeedrunKit returns a comprehensive application bundle', () => {
    const kit = SkillSyncSpeedrun.generateSpeedrunKit({
      resume: sampleCandidateResume,
      company: sampleTargetJob.company,
      role: sampleTargetJob.title,
      description: sampleTargetJob.description,
      salary: sampleTargetJob.salary,
      location: sampleTargetJob.location
    });

    expect(kit).toBeDefined();
    expect(kit.company).toBe('Nexus Robotics');
    expect(kit.role).toBe('Senior Cloud Platform Engineer');
    expect(Array.isArray(kit.tailored_bullets)).toBe(true);
    expect(kit.tailored_bullets.length).toBeGreaterThanOrEqual(3);
    expect(typeof kit.cover_letter).toBe('string');
    expect(kit.cover_letter.length).toBeGreaterThan(100);
    expect(typeof kit.outreach_dm).toBe('string');
    expect(kit.pipeline_record).toBeDefined();
    expect(kit.pipeline_record.status).toBe('Applied');
    expect(kit.pipeline_record.company).toBe('Nexus Robotics');
  });

  test('tailored bullets adhere strictly to the Google XYZ impact formula', () => {
    const kit = SkillSyncSpeedrun.generateSpeedrunKit({
      resume: sampleCandidateResume,
      company: sampleTargetJob.company,
      role: sampleTargetJob.title,
      description: sampleTargetJob.description
    });

    kit.tailored_bullets.forEach(item => {
      const bullet = typeof item === 'object' && item.bullet ? item.bullet : item;
      // Must contain measurable numbers, percentages, or metrics
      expect(bullet).toMatch(/\d+%/);
      // Must start with an active past-tense engineering verb
      expect(bullet).toMatch(/^(Architected|Spearheaded|Engineered|Optimized|Designed|Automated|Scaled|Streamlined|Modernized|Instrumented)/);
      // Must mention relevant target keywords or achievements
      expect(bullet.length).toBeGreaterThan(40);
    });
  });

  test('outreach DM stays strictly under LinkedIn 300 character limit', () => {
    const kit = SkillSyncSpeedrun.generateSpeedrunKit({
      resume: sampleCandidateResume,
      company: 'Very Long Enterprise Solutions Corporation Inc.',
      role: 'Principal Staff Distributed Cloud Platform Systems Engineer',
      description: sampleTargetJob.description
    });

    expect(kit.outreach_dm.length).toBeLessThanOrEqual(300);
    expect(kit.outreach_dm).toContain('Very Long Enterprise');
    expect(kit.outreach_dm.length).toBeGreaterThan(50);
  });

  test('cover letter contains personalized company name, role, and skills', () => {
    const kit = SkillSyncSpeedrun.generateSpeedrunKit({
      resume: sampleCandidateResume,
      company: 'Nexus Robotics',
      role: 'Senior Cloud Platform Engineer',
      description: sampleTargetJob.description
    });

    expect(kit.cover_letter).toContain('Nexus Robotics');
    expect(kit.cover_letter).toContain('Senior Cloud Platform Engineer');
    expect(kit.cover_letter).toContain('Dear Hiring Team');
  });

  test('formatSpeedrunResume incorporates tailored XYZ highlights cleanly', () => {
    const customBullets = [
      'Architected resilient cloud deployment pipelines on AWS, improving delivery velocity by 45%.',
      'Engineered automated observability dashboards with Prometheus, cutting MTTR by 30%.'
    ];

    const formattedResume = SkillSyncSpeedrun.formatSpeedrunResume(sampleCandidateResume, customBullets);
    expect(formattedResume).toContain('[ATS TARGETED HIGHLIGHTS & QUANTIFIED ACHIEVEMENTS]');
    expect(formattedResume).toContain('improving delivery velocity by 45%');
    expect(formattedResume).toContain('cutting MTTR by 30%');
    expect(formattedResume).toContain('Senior Software Engineer at Alpha Tech');
  });

  test('generateSpeedrunKit operates gracefully with empty or minimal inputs', () => {
    const fallbackKit = SkillSyncSpeedrun.generateSpeedrunKit({});
    expect(fallbackKit).toBeDefined();
    expect(fallbackKit.company).toBe('Tech Company');
    expect(fallbackKit.role).toBe('Software Engineer');
    expect(fallbackKit.tailored_bullets.length).toBeGreaterThanOrEqual(3);
    expect(fallbackKit.outreach_dm.length).toBeLessThanOrEqual(300);
    expect(fallbackKit.pipeline_record.status).toBe('Applied');
  });
});
