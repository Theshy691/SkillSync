/**
 * SkillSync - AI Career Action Suite & Job Pipeline Test Suite
 * File: tests/features.test.js
 *
 * @jest-environment jsdom
 */

const {
  renderResults,
  renderTailorBullets,
  renderInterviewQuestions,
  addJobToPipeline,
  updatePipelineJobStatus,
  deletePipelineJob,
  renderPipeline,
  switchWorkspaceTab,
  getPipelineJobs,
  setPipelineJobs
} = require('../script.js');

describe('Multi-Dimensional ATS Breakdown & AI Career Action Suite', () => {

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="results-container" class="hidden">
        <div id="scoreBadge"></div>
        <div id="scoreNumber"></div>
        <div id="scoreFeedback"></div>
        <div id="skillsBadgesContainer"></div>

        <!-- 4-Pillar Breakdown Elements -->
        <span id="breakdownCoreVal"></span>
        <div id="breakdownCoreBar"></div>
        <span id="breakdownCloudVal"></span>
        <div id="breakdownCloudBar"></div>
        <span id="breakdownExpVal"></span>
        <div id="breakdownExpBar"></div>
        <span id="breakdownDomainVal"></span>
        <div id="breakdownDomainBar"></div>
      </div>

      <!-- Modals -->
      <div id="tailor-modal" class="hidden">
        <div id="tailorLoading" class="hidden"></div>
        <div id="tailorAdviceText"></div>
        <div id="tailorBulletsList"></div>
      </div>

      <div id="coverletter-modal" class="hidden">
        <div id="clLoading" class="hidden"></div>
        <div id="clContentWrapper"></div>
        <textarea id="clLetterText"></textarea>
      </div>

      <div id="interview-modal" class="hidden">
        <div id="interviewLoading" class="hidden"></div>
        <div id="interviewQuestionsList"></div>
      </div>

      <!-- Workspace Tabs & Views -->
      <button id="tabAtsMatcher" class="tab-btn"></button>
      <button id="tabJobDiscovery" class="tab-btn"></button>
      <button id="tabSkillVault" class="tab-btn"></button>
      <button id="tabPipeline" class="tab-btn"></button>
      <span id="pipelineCountBadge">0</span>

      <div id="ats-view"></div>
      <div id="discovery-view" class="hidden"></div>
      <div id="vault-view" class="hidden"></div>
      <div id="pipeline-view" class="hidden">
        <span id="colCountSaved">0</span>
        <div id="colListSaved"></div>
        <span id="colCountApplied">0</span>
        <div id="colListApplied"></div>
        <span id="colCountInterviewing">0</span>
        <div id="colListInterviewing"></div>
        <span id="colCountOffer">0</span>
        <div id="colListOffer"></div>
      </div>
      <div id="toast-container"></div>
    `;
    setPipelineJobs([]);
    localStorage.clear();
  });

  describe('Multi-Dimensional ATS Breakdown', () => {
    test('renders 4 dimensional sub-scores when breakdown is provided', () => {
      const mockResult = {
        match_score: 82,
        missing_skills: ['Docker'],
        breakdown: {
          core_tech: 92,
          devops_cloud: 60,
          experience_depth: 85,
          domain_fit: 82
        }
      };

      renderResults(mockResult);

      expect(document.getElementById('breakdownCoreVal').textContent).toBe('92%');
      expect(document.getElementById('breakdownCoreBar').style.width).toBe('92%');
      expect(document.getElementById('breakdownCloudVal').textContent).toBe('60%');
      expect(document.getElementById('breakdownCloudBar').style.width).toBe('60%');
      expect(document.getElementById('breakdownExpVal').textContent).toBe('85%');
      expect(document.getElementById('breakdownDomainVal').textContent).toBe('82%');
    });

    test('does not invent dimension scores when the backend omitted them', () => {
      const mockResult = {
        match_score: 75,
        missing_skills: ['AWS']
      };

      renderResults(mockResult);

      expect(document.getElementById('breakdownCoreVal').textContent).toBe('Not assessed');
      expect(document.getElementById('breakdownDomainVal').textContent).toBe('Not assessed');
      expect(document.getElementById('breakdownCoreBar').style.width).toBe('0%');
    });
  });

  describe('1-Click AI Resume Tailorer', () => {
    test('renderTailorBullets populates XYZ formula bullets into list', () => {
      const sampleBullets = [
        {
          context: 'Distributed Systems',
          bullet: 'Architected async Kafka pipeline reducing delivery lag by 35%.',
          skills: ['Kafka', 'TypeScript']
        },
        {
          context: 'DevOps & Reliability',
          bullet: 'Containerized microservices with Docker, slashing build time by 50%.',
          skills: ['Docker']
        }
      ];

      renderTailorBullets(sampleBullets);

      const list = document.getElementById('tailorBulletsList');
      expect(list.children.length).toBe(2);
      expect(list.innerHTML).toContain('Distributed Systems');
      expect(list.innerHTML).toContain('slashing build time by 50%');
      expect(list.innerHTML).toContain('Kafka');
    });
  });

  describe('Technical Interview Prep Accordion', () => {
    test('renderInterviewQuestions populates technical questions with talking points', () => {
      const sampleQuestions = [
        {
          id: 1,
          category: 'Architecture Deep-Dive',
          target_skill: 'Redis',
          question: 'How do you prevent cache stampedes in high-throughput APIs?',
          interviewer_intent: 'Tests caching strategies and lock mechanisms.',
          talking_points: ['Probabilistic early expiration', 'Mutex locks', 'Read-through cache']
        }
      ];

      renderInterviewQuestions(sampleQuestions);

      const list = document.getElementById('interviewQuestionsList');
      expect(list.children.length).toBe(1);
      expect(list.innerHTML).toContain('cache stampedes');
      expect(list.innerHTML).toContain('Probabilistic early expiration');
      expect(list.innerHTML).toContain('Redis');
    });
  });

  describe('Job Application Pipeline Kanban Board', () => {
    test('addJobToPipeline appends new job and renders in Saved column', () => {
      addJobToPipeline({
        id: 'pipe-test-1',
        title: 'Senior Cloud Architect',
        company_name: 'HashiCorp',
        location: 'Remote',
        salary: '$160k - $210k',
        score: 85
      }, 'saved');

      const savedCol = document.getElementById('colListSaved');
      const savedCount = document.getElementById('colCountSaved');

      expect(savedCol.innerHTML).toContain('Senior Cloud Architect');
      expect(savedCol.innerHTML).toContain('HashiCorp');
      expect(savedCount.textContent).toBe('1');
    });

    test('updatePipelineJobStatus moves role between columns', () => {
      addJobToPipeline({
        id: 'pipe-test-2',
        title: 'Full-Stack Developer',
        company_name: 'Stripe',
        score: 90
      }, 'saved');

      expect(document.getElementById('colCountSaved').textContent).toBe('1');
      expect(document.getElementById('colCountApplied').textContent).toBe('0');

      updatePipelineJobStatus('pipe-test-2', 'applied');

      expect(document.getElementById('colCountSaved').textContent).toBe('0');
      expect(document.getElementById('colCountApplied').textContent).toBe('1');
      expect(document.getElementById('colListApplied').innerHTML).toContain('Stripe');
    });

    test('deletePipelineJob removes role from board', () => {
      addJobToPipeline({
        id: 'pipe-test-3',
        title: 'DevOps Engineer',
        company_name: 'GitLab',
        score: 75
      }, 'saved');

      expect(getPipelineJobs().length).toBe(1);
      deletePipelineJob('pipe-test-3');
      expect(getPipelineJobs().length).toBe(0);
      expect(document.getElementById('colCountSaved').textContent).toBe('0');
    });

    test('switchWorkspaceTab switches cleanly to pipeline tab', () => {
      switchWorkspaceTab('pipeline');

      const pipelineView = document.getElementById('pipeline-view');
      const atsView = document.getElementById('ats-view');
      const tabPipeline = document.getElementById('tabPipeline');

      expect(pipelineView.classList.contains('hidden')).toBe(false);
      expect(atsView.classList.contains('hidden')).toBe(true);
      expect(tabPipeline.className).toContain('font-bold');
    });

    test('retained workspace tabs work without the embedded job explorer', () => {
      document.getElementById('tabJobDiscovery').remove();
      document.getElementById('discovery-view').remove();
      switchWorkspaceTab('vault');
      expect(document.getElementById('vault-view').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('ats-view').classList.contains('hidden')).toBe(true);
      switchWorkspaceTab('ats');
      expect(document.getElementById('ats-view').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('vault-view').classList.contains('hidden')).toBe(true);
    });
  });

});
