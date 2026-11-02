/**
 * @file tests/authenticity.test.js
 * Comprehensive unit test suite for the Resume Credibility & Anti-Hallucination Audit Engine
 */

const SkillSyncAuthenticity = require('../assets/js/modules/authenticity.js');

describe('Resume Credibility & Anti-Hallucination Audit Engine Test Suite', () => {
  const currentYear = 2026;

  describe('Tech Timeline Anachronisms', () => {
    test('flags impossible claims where experience years exceed technology release date', () => {
      const fakeResume = `
        Jane Doe
        Skills: 8 years of experience with LangChain and 15 years with Kubernetes.
      `;

      const anomalies = SkillSyncAuthenticity.checkTechAnachronisms(fakeResume, currentYear);

      expect(anomalies.length).toBeGreaterThanOrEqual(2);
      const techs = anomalies.map(a => a.tech);
      expect(techs).toContain('langchain');
      expect(techs).toContain('kubernetes');
    });

    test('passes truthful claims where years are within real-world limits', () => {
      const truthfulResume = `
        Alex Mercer
        Experience: 4 years of experience with React and 3 years with Docker.
      `;

      const anomalies = SkillSyncAuthenticity.checkTechAnachronisms(truthfulResume, currentYear);
      expect(anomalies.length).toBe(0);
    });
  });

  describe('Skills-to-Evidence Substantiation (Buzzword Stuffing)', () => {
    test('detects buzzword stuffing when skills in header are never evidenced in projects', () => {
      const stuffedResume = `
        Skills: React, Node.js, Rust, Solidity, COBOL, Haskell, Kubernetes, Kafka, Terraform
        
        Experience:
        Frontend Engineer at Alpha (2022 - Present)
        • Built user interfaces using React and Node.js.
      `;

      const result = SkillSyncAuthenticity.checkSkillsSubstantiation(stuffedResume);

      expect(result.listedCount).toBeGreaterThanOrEqual(7);
      expect(result.ratio).toBeLessThan(50);
      expect(result.unbackedSkills).toContain('Rust');
      expect(result.unbackedSkills).toContain('Solidity');
    });

    test('rewards resumes where listed skills are substantiated in work history', () => {
      const solidResume = `
        Technical Skills: React, Node.js, Docker, PostgreSQL
        
        Work History:
        Software Engineer at Beta Tech (2021 - 2024)
        • Designed microservices using Node.js and PostgreSQL.
        • Containerized services with Docker and built UI with React.
      `;

      const result = SkillSyncAuthenticity.checkSkillsSubstantiation(solidResume);
      expect(result.ratio).toBeGreaterThanOrEqual(75);
      expect(result.unbackedSkills.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Metric Plausibility & Sanity', () => {
    test('flags extreme 4-digit percentage spikes as statistically implausible', () => {
      const exaggeratedResume = `
        • Increased company conversion rates by 5000% single-handedly.
      `;

      const flags = SkillSyncAuthenticity.checkMetricPlausibility(exaggeratedResume);
      expect(flags.length).toBeGreaterThan(0);
      expect(flags[0].type).toBe('extreme_percentage');
    });

    test('flags billion-scale user claims with zero architecture or cloud backing', () => {
      const absurdScaleResume = `
        • Handled 10 billion transactions for small local store website.
      `;

      const flags = SkillSyncAuthenticity.checkMetricPlausibility(absurdScaleResume);
      expect(flags.length).toBeGreaterThan(0);
      expect(flags[0].type).toBe('unsupported_scale');
    });
  });

  describe('Timeline & Seniority Consistency', () => {
    test('flags title inflation when candidate claims CTO or Staff title with under 2 years experience', () => {
      const inflatedResume = `
        Chief Technology Officer at Startup Co (2024 - 2025)
        • Managed website deployment.
      `;

      const flags = SkillSyncAuthenticity.checkTimelineSeniority(inflatedResume);
      expect(flags.some(f => f.type === 'seniority_mismatch')).toBe(true);
    });

    test('flags chronologically impossible inverted date ranges', () => {
      const invertedResume = `
        Developer at Omega Systems (2025 - 2022)
      `;

      const flags = SkillSyncAuthenticity.checkTimelineSeniority(invertedResume);
      expect(flags.some(f => f.type === 'reversed_date_range')).toBe(true);
    });
  });

  describe('Ghost Contribution & Passive Phrasing', () => {
    test('identifies passive phrases and recommends active leadership alternatives', () => {
      const passiveResume = `
        • Participated in agile sprint meetings.
        • Assisted with deployment tasks.
        • Exposed to cloud architecture.
      `;

      const ghostMatches = SkillSyncAuthenticity.checkGhostPhrases(passiveResume);
      expect(ghostMatches.length).toBeGreaterThanOrEqual(3);
      expect(ghostMatches.map(m => m.phrase)).toContain('participated in');
      expect(ghostMatches.map(m => m.phrase)).toContain('assisted with');
    });
  });

  describe('Master Audit Scoring & Report Generation', () => {
    test('awards high credibility score to truthful, evidenced resume', () => {
      const authenticResume = `
        Technical Skills: React, TypeScript, Docker, PostgreSQL
        
        Experience:
        Senior Software Engineer at Nexus (2020 - 2025)
        • Architected responsive frontend with React and TypeScript.
        • Deployed distributed services on Docker with PostgreSQL database.
        • Reduced API latency by 35% through query optimization.
      `;

      const audit = SkillSyncAuthenticity.auditResumeIntegrity(authenticResume, currentYear);

      expect(audit.score).toBeGreaterThanOrEqual(85);
      expect(audit.totalFlags).toBe(0);
      expect(audit.anachronisms.length).toBe(0);

      const html = SkillSyncAuthenticity.renderIntegrityReportHtml(audit);
      expect(html).toContain('Zero critical credibility anomalies detected');
    });

    test('significantly penalizes fabricated resume with anachronisms and buzzword stuffing', () => {
      const fakeResume = `
        Skills: LangChain, Kubernetes, Rust, COBOL, Solidity
        
        Experience:
        Chief Technology Officer (2024 - 2025)
        • 8 years of experience with LangChain.
        • Increased revenue by 8000%.
        • Helped with tasks.
      `;

      const audit = SkillSyncAuthenticity.auditResumeIntegrity(fakeResume, currentYear);

      expect(audit.score).toBeLessThan(65);
      expect(audit.status).toBe('high_risk');
      expect(audit.anachronisms.length).toBeGreaterThan(0);
      expect(audit.metricFlags.length).toBeGreaterThan(0);

      const html = SkillSyncAuthenticity.renderIntegrityReportHtml(audit);
      expect(html).toContain('Tech Timeline Anachronism');
      expect(html).toContain('High Embellishment Risk');
    });
  });
});

