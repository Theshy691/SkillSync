/**
 * SkillSync - Pipeline Analytics & Smart Follow-Up Test Suite
 * File: tests/pipeline_analytics.test.js
 *
 * @jest-environment jsdom
 */

const {
  calculatePipelineMetrics,
  renderPipelineAnalytics,
  checkFollowupDue,
  generateFollowupEmail,
  openFollowupModal
} = require('../script.js');

describe('Pipeline Analytics & Smart Follow-Up System Test Suite', () => {

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="pipelineAnalyticsPanel">
        <span id="metricTotalRoles"></span>
        <span id="metricActiveInFlight"></span>
        <span id="metricInterviewRate"></span>
        <span id="metricAvgFit"></span>
        <span id="metricOfferCount"></span>
        <div id="funnelBarSaved" style="width: 25%"></div>
        <div id="funnelBarApplied" style="width: 25%"></div>
        <div id="funnelBarInterview" style="width: 25%"></div>
        <div id="funnelBarOffer" style="width: 25%"></div>
      </div>
      <button id="togglePipelineAnalyticsBtn"></button>

      <div id="followup-modal" class="hidden">
        <input type="text" id="followupCompanyInput" />
        <input type="text" id="followupRoleInput" />
        <select id="followupTypeSelect">
          <option value="checkin">Checkin</option>
          <option value="thankyou">Thankyou</option>
          <option value="status">Status</option>
        </select>
        <input type="text" id="followupSubjectInput" />
        <textarea id="followupBodyText"></textarea>
        <button id="copyFollowupEmailBtn"></button>
        <button id="closeFollowupModalBtn"></button>
        <button id="closeFollowupBtnBottom"></button>
      </div>

      <div id="toast-container"></div>
    `;
    jest.clearAllMocks();
  });

  describe('Pipeline Metrics & Conversion Funnel Calculation', () => {
    test('calculates correct conversion rates across funnel stages', () => {
      const mockJobs = [
        { id: '1', status: 'saved', score: 80 },
        { id: '2', status: 'applied', score: 85 },
        { id: '3', status: 'applied', score: 75 },
        { id: '4', status: 'interviewing', score: 90 },
        { id: '5', status: 'offer', score: 95 }
      ];

      const metrics = calculatePipelineMetrics(mockJobs);
      expect(metrics.total).toBe(5);
      expect(metrics.saved).toBe(1);
      expect(metrics.applied).toBe(2);
      expect(metrics.interviewing).toBe(1);
      expect(metrics.offer).toBe(1);
      expect(metrics.activeInFlight).toBe(3); // applied + interviewing

      // Denominator: applied(2) + interviewing(1) + offer(1) = 4
      // Interviewing + Offer = 2 / 4 = 50%
      expect(metrics.interviewRate).toBe(50);
      // Offer rate = 1 / 4 = 25%
      expect(metrics.offerRate).toBe(25);
      expect(metrics.avgScore).toBe(85);
    });

    test('handles empty pipeline without division by zero errors', () => {
      const metrics = calculatePipelineMetrics([]);
      expect(metrics.total).toBe(0);
      expect(metrics.interviewRate).toBe(0);
      expect(metrics.offerRate).toBe(0);
    });

    test('renderPipelineAnalytics updates DOM metric spans and progress bars', () => {
      const metrics = {
        total: 10,
        saved: 2,
        applied: 4,
        interviewing: 3,
        offer: 1,
        activeInFlight: 7,
        interviewRate: 50,
        offerRate: 12,
        avgScore: 84
      };

      renderPipelineAnalytics(metrics);

      expect(document.getElementById('metricTotalRoles').textContent).toBe('10');
      expect(document.getElementById('metricActiveInFlight').textContent).toBe('7');
      expect(document.getElementById('metricInterviewRate').textContent).toBe('50%');
      expect(document.getElementById('metricAvgFit').textContent).toBe('84%');
      expect(document.getElementById('metricOfferCount').textContent).toBe('1 Offer');
    });
  });

  describe('Smart Follow-Up Reminder & Email Generator', () => {
    test('identifies applied role 6 days ago as follow-up due', () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const job = {
        status: 'applied',
        created_at: sixDaysAgo
      };

      const res = checkFollowupDue(job);
      expect(res.due).toBe(true);
      expect(res.type).toBe('checkin');
      expect(res.days).toBeGreaterThanOrEqual(5);
    });

    test('identifies interviewing role 4 days ago as status check due', () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const job = {
        status: 'interviewing',
        created_at: fourDaysAgo
      };

      const res = checkFollowupDue(job);
      expect(res.due).toBe(true);
      expect(res.type).toBe('status');
      expect(res.days).toBeGreaterThanOrEqual(3);
    });

    test('returns due false for recently applied role (1 day ago)', () => {
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const job = {
        status: 'applied',
        created_at: yesterday
      };

      const res = checkFollowupDue(job);
      expect(res.due).toBe(false);
    });

    test('generateFollowupEmail generates customized draft for checkin, thankyou, and status', () => {
      const checkin = generateFollowupEmail('Stripe', 'Full-Stack Engineer', 'checkin');
      expect(checkin.subject).toContain('Full-Stack Engineer');
      expect(checkin.body).toContain('Stripe');
      expect(checkin.body).toContain('reiterate my strong enthusiasm');

      const thankyou = generateFollowupEmail('Vercel', 'Frontend Architect', 'thankyou');
      expect(thankyou.subject).toContain('Frontend Architect');
      expect(thankyou.body).toContain('Vercel');
      expect(thankyou.body).toContain('Thank you so much');

      const status = generateFollowupEmail('Google', 'Cloud Engineer', 'status');
      expect(status.subject).toContain('Cloud Engineer');
      expect(status.body).toContain('Google');
      expect(status.body).toContain('next steps in the hiring process');
    });

    test('openFollowupModal populates inputs and unhides modal', () => {
      const job = {
        company_name: 'Airbnb',
        title: 'Senior Software Engineer'
      };

      openFollowupModal(job, 'thankyou');

      const modal = document.getElementById('followup-modal');
      expect(modal.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('followupCompanyInput').value).toBe('Airbnb');
      expect(document.getElementById('followupRoleInput').value).toBe('Senior Software Engineer');
      expect(document.getElementById('followupBodyText').value).toContain('Airbnb');
    });
  });
});

