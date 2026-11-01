/**
 * SkillSync - Salary Benchmarking & Negotiation Coach Test Suite
 * File: tests/salary.test.js
 *
 * @jest-environment jsdom
 */

const {
  calculateSalaryBenchmarks,
  renderSalaryInsights,
  openSalaryModal
} = require('../script.js');

describe('Salary Benchmarking & AI Negotiation Coach Test Suite', () => {

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="salary-modal" class="hidden">
        <input type="text" id="salaryRoleInput" />
        <input type="text" id="salaryLocationInput" />
        <input type="text" id="salaryOfferInput" />
        <button id="recalculateSalaryBtn"></button>
        <button id="closeSalaryModalBtn"></button>
        <button id="closeSalaryBtnBottom"></button>
        
        <span id="salaryBenchP25"></span>
        <span id="salaryBenchMedian"></span>
        <span id="salaryBenchP75"></span>
        <span id="salaryBenchP90"></span>
        <span id="salaryTargetCounter"></span>
        <span id="salaryOfferStatusBadge"></span>
        <ul id="salaryTalkingPointsList"></ul>
        <textarea id="salaryScriptText"></textarea>
        <button id="copySalaryScriptBtn"></button>
      </div>
      <button id="salaryCoachBtn"></button>
      <div id="toast-container"></div>
      <textarea id="jobText"></textarea>
    `;
    jest.clearAllMocks();
  });

  describe('Salary Calculation & Percentiles Algorithm', () => {
    test('calculates correct percentiles hierarchy (p25 < median < p75 < p90)', () => {
      const res = calculateSalaryBenchmarks('Senior Full-Stack Engineer', 'Remote', ['React', 'TypeScript', 'AWS'], 140000);
      expect(res.success).toBe(true);
      expect(res.benchmarks.p25).toBeLessThan(res.benchmarks.median);
      expect(res.benchmarks.median).toBeLessThan(res.benchmarks.p75);
      expect(res.benchmarks.p75).toBeLessThan(res.benchmarks.p90);
    });

    test('applies seniority tiers (Lead/Staff > Senior > Junior)', () => {
      const junior = calculateSalaryBenchmarks('Junior Frontend Developer', 'Remote', []);
      const senior = calculateSalaryBenchmarks('Senior Frontend Developer', 'Remote', []);
      const lead = calculateSalaryBenchmarks('Lead Architect', 'Remote', []);

      expect(senior.benchmarks.median).toBeGreaterThan(junior.benchmarks.median);
      expect(lead.benchmarks.median).toBeGreaterThan(senior.benchmarks.median);
    });

    test('applies location multiplier for high cost of living markets', () => {
      const remote = calculateSalaryBenchmarks('Senior Engineer', 'Remote', []);
      const sf = calculateSalaryBenchmarks('Senior Engineer', 'San Francisco, CA', []);

      expect(sf.benchmarks.median).toBeGreaterThan(remote.benchmarks.median);
    });

    test('identifies below_market offer and suggests anchor counter', () => {
      const res = calculateSalaryBenchmarks('Senior Cloud Engineer', 'San Francisco', ['AWS', 'Kubernetes'], '$110,000');
      expect(res.offer_analysis.status).toBe('below_market');
      expect(res.benchmarks.target_counter).toBeGreaterThan(110000);
    });

    test('generates professional counter-offer email script', () => {
      const res = calculateSalaryBenchmarks('Staff Systems Engineer', 'Remote', ['Go', 'Docker'], '$160,000');
      expect(res.script).toContain('Staff Systems Engineer');
      expect(res.script).toContain('Remote');
      expect(res.script).toContain('base salary of');
      expect(res.script).toContain('Dear [Hiring Manager / Recruiter]');
    });
  });

  describe('Salary UI Rendering & Modal Integration', () => {
    test('renderSalaryInsights populates benchmark cards and talking points', () => {
      const mockData = calculateSalaryBenchmarks('DevOps Engineer', 'Remote', ['Docker', 'AWS'], 135000);
      renderSalaryInsights(mockData);

      expect(document.getElementById('salaryBenchP25').textContent).toContain('$');
      expect(document.getElementById('salaryBenchMedian').textContent).toContain('$');
      expect(document.getElementById('salaryTargetCounter').textContent).toContain('$');
      expect(document.getElementById('salaryScriptText').value).toContain('DevOps Engineer');

      const talkingPoints = document.querySelectorAll('#salaryTalkingPointsList li');
      expect(talkingPoints.length).toBeGreaterThan(0);
    });

    test('openSalaryModal unhides modal and prepopulates inputs', async () => {
      const job = {
        title: 'Senior Reliability Engineer',
        location: 'Remote (US)',
        salary: '$165,000',
        tags: ['AWS', 'Docker', 'Kubernetes']
      };

      await openSalaryModal(job);

      const modal = document.getElementById('salary-modal');
      expect(modal.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('salaryRoleInput').value).toBe('Senior Reliability Engineer');
      expect(document.getElementById('salaryLocationInput').value).toBe('Remote (US)');
      expect(document.getElementById('salaryOfferInput').value).toBe('$165,000');
    });
  });
});
