/**
 * @jest-environment jsdom
 */

const {
  generateRoadmapCurriculum,
  loadRoadmapProgress,
  saveRoadmapProgress,
  renderRoadmap,
  toggleRoadmapMilestone,
  resetRoadmapProgress,
  openRoadmapModal,
  initRoadmap,
  getCurrentRoadmapData
} = require('../script.js');

describe('2-Week Skill Bridge Learning Roadmap Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="roadmap-modal" class="hidden">
        <button id="closeRoadmapModalBtn"></button>
        <span id="roadmapSubtitle"></span>
        <span id="roadmapProgressText"></span>
        <div id="roadmapProgressBar" style="width: 0%"></div>
        <div id="roadmapMilestonesList"></div>
        <button id="resetRoadmapProgressBtn"></button>
        <button id="closeRoadmapBtnBottom"></button>
      </div>
      <button id="generateRoadmapBtn"></button>
      <textarea id="jobText"></textarea>
      <div id="toast-container"></div>
    `;
  });

  describe('Curriculum Generation Algorithm', () => {
    test('generates 6 structured milestones spanning 14 days for target skills', () => {
      const skills = ['Docker', 'Kubernetes', 'PostgreSQL'];
      const milestones = generateRoadmapCurriculum(skills);

      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones).toHaveLength(6);

      expect(milestones[0].dayRange).toBe('Days 1–2');
      expect(milestones[0].skill).toBe('Docker');
      expect(milestones[0].title).toContain('Docker: Core Mental Model');
      expect(milestones[0].hours).toBe('4 hrs');
      expect(milestones[0].docsUrl).toBeTruthy();

      expect(milestones[2].skill).toBe('Kubernetes');
      expect(milestones[4].skill).toBe('PostgreSQL');
      expect(milestones[5].dayRange).toBe('Days 13–14');
      expect(milestones[5].title).toContain('Capstone');
    });

    test('falls back to standard fullstack bridge curriculum when no missing skills provided', () => {
      const milestones = generateRoadmapCurriculum([]);
      expect(milestones).toHaveLength(6);
      expect(milestones[0].skill).toBe('System Architecture');
      expect(milestones[2].skill).toBe('Modern Cloud / DevOps');
    });
  });

  describe('UI Rendering & Progress Tracking', () => {
    test('renderRoadmap renders milestone cards and calculates 0% initial progress', () => {
      const milestones = generateRoadmapCurriculum(['TypeScript', 'GraphQL']);
      renderRoadmap(milestones);

      const list = document.getElementById('roadmapMilestonesList');
      const text = document.getElementById('roadmapProgressText');
      const bar = document.getElementById('roadmapProgressBar');

      expect(list.children.length).toBe(6);
      expect(text.textContent).toContain('0 / 6 Milestones (0%)');
      expect(bar.style.width).toBe('0%');
      expect(list.innerHTML).toContain('TypeScript');
      expect(list.innerHTML).toContain('Video Tutorial');
    });

    test('toggleRoadmapMilestone toggles completion state and updates progress bar', () => {
      const milestones = generateRoadmapCurriculum(['React', 'Redux']);
      renderRoadmap(milestones);

      // Toggle first milestone
      toggleRoadmapMilestone('milestone_1');

      const saved = JSON.parse(localStorage.getItem('skillsync_roadmap_progress'));
      expect(saved['milestone_1']).toBe(true);

      const text = document.getElementById('roadmapProgressText');
      const bar = document.getElementById('roadmapProgressBar');
      expect(text.textContent).toContain('1 / 6 Milestones (17%)');
      expect(bar.style.width).toBe('17%');

      // Toggle second milestone
      toggleRoadmapMilestone('milestone_2');
      expect(text.textContent).toContain('2 / 6 Milestones (33%)');
      expect(bar.style.width).toBe('33%');

      // Untoggle first milestone
      toggleRoadmapMilestone('milestone_1');
      expect(text.textContent).toContain('1 / 6 Milestones (17%)');
    });

    test('resetRoadmapProgress clears completion and restores 0% progress', () => {
      const milestones = generateRoadmapCurriculum(['Python']);
      renderRoadmap(milestones);

      toggleRoadmapMilestone('milestone_1');
      toggleRoadmapMilestone('milestone_2');
      expect(document.getElementById('roadmapProgressText').textContent).toContain('2 / 6');

      resetRoadmapProgress();
      expect(localStorage.getItem('skillsync_roadmap_progress')).toBe('{}');
      expect(document.getElementById('roadmapProgressText').textContent).toContain('0 / 6 Milestones (0%)');
      expect(document.getElementById('roadmapProgressBar').style.width).toBe('0%');
    });
  });

  describe('Modal Navigation & Event Delegation', () => {
    test('openRoadmapModal unhides modal and extracts skills from job description', () => {
      document.getElementById('jobText').value = 'Senior Backend Engineer requiring Go, Redis, and Kafka in AWS.';
      openRoadmapModal();

      const modal = document.getElementById('roadmap-modal');
      expect(modal.classList.contains('hidden')).toBe(false);

      const list = document.getElementById('roadmapMilestonesList');
      expect(list.children.length).toBe(6);
    });

    test('initRoadmap registers modal open, close, and milestone toggle events', () => {
      initRoadmap();
      const openBtn = document.getElementById('generateRoadmapBtn');
      const closeBtn = document.getElementById('closeRoadmapModalBtn');
      const resetBtn = document.getElementById('resetRoadmapProgressBtn');
      const modal = document.getElementById('roadmap-modal');

      openBtn.click();
      expect(modal.classList.contains('hidden')).toBe(false);

      // Click toggle button inside list via delegation
      const toggleBtn = document.querySelector('.roadmap-toggle-btn');
      expect(toggleBtn).toBeTruthy();
      toggleBtn.click();
      expect(document.getElementById('roadmapProgressText').textContent).toContain('1 / 6 Milestones');

      resetBtn.click();
      expect(document.getElementById('roadmapProgressText').textContent).toContain('0 / 6 Milestones');

      closeBtn.click();
      expect(modal.classList.contains('hidden')).toBe(true);
    });
  });
});

