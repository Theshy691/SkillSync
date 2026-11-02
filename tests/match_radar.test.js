/**
 * @file tests/match_radar.test.js
 * Comprehensive unit test suite for the Auto-Match Radar Engine
 */

const SkillSyncSpeedrun = require('../assets/js/modules/speedrun.js');

describe('Auto-Match Radar Engine Test Suite', () => {
  const sampleCandidateResume = `
    Jane Doe - Full Stack Cloud Developer
    Technologies: React, Node.js, TypeScript, AWS, Docker, GraphQL, PostgreSQL
  `;

  const sampleJobs = [
    {
      id: 1,
      title: 'Full Stack TypeScript Engineer',
      company: 'AppForge',
      tags: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      description: 'Building modern web applications using React, TypeScript, and PostgreSQL.'
    },
    {
      id: 2,
      title: 'Senior Embedded Firmware Engineer',
      company: 'AeroDrone',
      tags: ['C++', 'RTOS', 'Rust', 'FPGA'],
      description: 'Low-level microcontroller firmware development for autonomous avionics.'
    },
    {
      id: 3,
      title: 'DevOps & Cloud Engineer',
      company: 'ScaleGrid',
      tags: ['AWS', 'Docker', 'Kubernetes', 'Terraform'],
      description: 'Managing scalable multi-region AWS cloud infrastructure and Docker containers.'
    }
  ];

  test('calculateMatchRadar annotates all jobs with accurate match scores and badge metadata', () => {
    const radarResults = SkillSyncSpeedrun.calculateMatchRadar(sampleCandidateResume, sampleJobs);

    expect(radarResults).toHaveLength(3);

    // Job 1 should be a high match (shares React, TypeScript, Node.js, PostgreSQL)
    const appForge = radarResults.find(j => j.company === 'AppForge');
    expect(appForge.matchScore).toBeGreaterThanOrEqual(80);
    expect(appForge.matchBadgeClass).toBe('chip-match-high');
    expect(appForge.matchBadgeText).toContain('Strong Match');

    // Job 2 should be a reach/growth match (different tech stack: C++, RTOS, FPGA)
    const aeroDrone = radarResults.find(j => j.company === 'AeroDrone');
    expect(aeroDrone.matchScore).toBeLessThan(65);
    expect(aeroDrone.matchBadgeClass).toMatch(/chip-match-(mid|reach)/);

    // Job 3 should be moderate to high (shares AWS and Docker)
    const scaleGrid = radarResults.find(j => j.company === 'ScaleGrid');
    expect(scaleGrid.matchScore).toBeGreaterThanOrEqual(60);
  });

  test('sortJobsByMatchFit orders jobs strictly descending by candidate match fit', () => {
    const sorted = SkillSyncSpeedrun.sortJobsByMatchFit(sampleJobs, sampleCandidateResume);

    expect(sorted).toHaveLength(3);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].matchScore).toBeGreaterThanOrEqual(sorted[i + 1].matchScore);
    }
    expect(sorted[0].company).toBe('AppForge');
  });

  test('filterHighMatchJobs filters out jobs below the specified minimum threshold', () => {
    const highMatchOnly = SkillSyncSpeedrun.filterHighMatchJobs(sampleJobs, sampleCandidateResume, 75);

    expect(highMatchOnly.length).toBeGreaterThanOrEqual(1);
    expect(highMatchOnly.every(j => j.matchScore >= 75)).toBe(true);
    expect(highMatchOnly.some(j => j.company === 'AeroDrone')).toBe(false);
  });

  test('calculateMatchRadar handles empty or non-string candidate resume safely', () => {
    const fallbackResults = SkillSyncSpeedrun.calculateMatchRadar('', sampleJobs);

    expect(fallbackResults).toHaveLength(3);
    fallbackResults.forEach(job => {
      expect(typeof job.matchScore).toBe('number');
      expect(job.matchScore).toBeGreaterThanOrEqual(50);
      expect(job.matchScore).toBeLessThanOrEqual(100);
      expect(job.matchBadgeText).toBeDefined();
    });
  });

  test('calculateMatchRadar handles empty jobs list safely', () => {
    const emptyResults = SkillSyncSpeedrun.calculateMatchRadar(sampleCandidateResume, []);
    expect(emptyResults).toEqual([]);
  });
});

