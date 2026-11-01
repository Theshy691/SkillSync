/**
 * SkillSync - Resume Version Manager Test Suite
 * File: tests/resume_versions.test.js
 *
 * @jest-environment jsdom
 */

const {
  saveResumeVersion,
  deleteResumeVersion,
  switchResumeVersion,
  initResumeVersionManager,
  getResumeVersions,
  setResumeVersions
} = require('../script.js');

describe('Resume Version Manager Test Suite', () => {

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="resumeVersionSelect"></select>
      <button id="saveResumeVersionBtn"></button>
      <button id="deleteResumeVersionBtn"></button>

      <div id="save-version-modal" class="hidden">
        <input type="text" id="newVersionNameInput" />
        <button id="closeSaveVersionModalBtn"></button>
        <button id="cancelSaveVersionBtn"></button>
        <button id="confirmSaveVersionBtn"></button>
      </div>

      <textarea id="resumeText"></textarea>
      <span id="resumeCount">0 / 5,000</span>
      <div id="toast-container"></div>
    `;

    setResumeVersions([
      {
        id: 'test-v1',
        name: 'Full-Stack v1',
        content: 'Experienced in Node, React, and PostgreSQL.',
        updated_at: '2026-10-31'
      },
      {
        id: 'test-v2',
        name: 'Cloud Engineer v2',
        content: 'Experienced in AWS, Docker, and Kubernetes.',
        updated_at: '2026-10-31'
      }
    ]);

    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Version Storage & Switching', () => {
    test('switchResumeVersion populates textarea with selected profile content', () => {
      switchResumeVersion('test-v2');

      const textarea = document.getElementById('resumeText');
      const counter = document.getElementById('resumeCount');

      expect(textarea.value).toBe('Experienced in AWS, Docker, and Kubernetes.');
      expect(counter.textContent).toContain(' / 5,000');
    });

    test('saveResumeVersion adds new version and saves to localStorage', () => {
      const initialCount = getResumeVersions().length;
      const newVer = saveResumeVersion('DevOps Lead', 'Kubernetes, Terraform, CI/CD');

      expect(newVer).toBeDefined();
      expect(newVer.name).toBe('DevOps Lead');
      expect(getResumeVersions().length).toBe(initialCount + 1);

      const savedRaw = localStorage.getItem('skillsync_resume_versions');
      expect(savedRaw).toContain('DevOps Lead');
    });

    test('deleteResumeVersion removes version and selects next available', () => {
      expect(getResumeVersions().length).toBe(2);

      const deleted = deleteResumeVersion('test-v1');
      expect(deleted).toBe(true);
      expect(getResumeVersions().length).toBe(1);
      expect(getResumeVersions()[0].id).toBe('test-v2');
    });

    test('deleteResumeVersion prevents deleting the last remaining version', () => {
      setResumeVersions([
        { id: 'solo-v1', name: 'Sole Resume', content: 'Only content.' }
      ]);

      const deleted = deleteResumeVersion('solo-v1');
      expect(deleted).toBe(false);
      expect(getResumeVersions().length).toBe(1);
    });
  });

  describe('UI Event Handling & Modal', () => {
    test('initResumeVersionManager populates select and handles switching', () => {
      initResumeVersionManager();

      const select = document.getElementById('resumeVersionSelect');
      expect(select.children.length).toBe(2);
      expect(select.children[0].textContent).toBe('Full-Stack v1');

      // Trigger change
      select.value = 'test-v2';
      select.dispatchEvent(new Event('change'));

      const textarea = document.getElementById('resumeText');
      expect(textarea.value).toBe('Experienced in AWS, Docker, and Kubernetes.');
    });
  });
});
