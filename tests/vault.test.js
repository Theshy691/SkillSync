/**
 * SkillSync - Skill Vault & Multi-Document Profile Synthesis Test Suite
 * File: tests/vault.test.js
 *
 * @jest-environment jsdom
 */

const {
  getAllVaultSkills,
  getSkillLogoSvg,
  renderVaultUI,
  addDocumentToVault,
  deleteVaultDocument,
  syncVaultToWorkspace,
  initSkillVault,
  calculateJobCompatibility,
  getVaultDocumentsCache,
  getVerifiedSkillsMatrix,
  switchWorkspaceTab
} = require('../script');

describe('Skill Vault & Multi-Document Profile Synthesis Test Suite', () => {

  beforeEach(() => {
    // Setup clean DOM mimicking app.html
    document.body.innerHTML = `
      <div id="toast-container"></div>
      <button id="tabAtsMatcher" class="tab-btn"></button>
      <button id="tabJobDiscovery" class="tab-btn"></button>
      <button id="tabSkillVault" class="tab-btn"></button>
      <span id="vaultDocsCountBadge">0</span>
      <span id="discoveryCountBadge">0</span>
      <span id="scoringStatusText"></span>

      <div id="ats-view"></div>
      <div id="discovery-view" class="hidden"></div>
      <div id="vault-view" class="hidden">
        <span id="vaultDocTotalBadge">0 Files</span>
        <div id="vaultDocumentsList"></div>
        <div id="vaultMatrixLanguages"></div>
        <div id="vaultMatrixFrameworks"></div>
        <div id="vaultMatrixCloud"></div>
        <div id="vaultMatrixCertifications"></div>
        <button id="uploadVaultDocBtn"></button>
        <input type="file" id="vaultDocFileInput" class="hidden" />
        <button id="syncVaultToWorkspaceBtn"></button>
      </div>

      <div id="jobsLoading" class="hidden"></div>
      <div id="jobsGrid"></div>
      <div id="jobsEmpty" class="hidden"></div>
      <div id="jobsPagination" class="hidden">
        <span id="paginationRange"></span>
        <span id="paginationTotal"></span>
        <span id="pageIndicator"></span>
        <button id="prevJobsPageBtn"></button>
        <button id="nextJobsPageBtn"></button>
      </div>

      <textarea id="resumeText"></textarea>
      <span id="resumeCount">0 / 5,000</span>
      <textarea id="jobText"></textarea>
      <span id="jobCount">0 / 5,000</span>
      <span id="scrapeStatusBadge"></span>
      <button id="analyzeBtn"></button>
    `;

    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    jest.clearAllMocks();
  });

  describe('Vault Matrix & Skill Aggregation', () => {
    test('getAllVaultSkills returns lowercased array of verified skills', () => {
      const skills = getAllVaultSkills();
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
      expect(skills).toContain('react');
      expect(skills).toContain('typescript');
      expect(skills).toContain('docker');
    });

    test('addDocumentToVault extracts skills and adds document to cache', () => {
      const initialCount = getVaultDocumentsCache().length;
      const docName = 'GCP_Professional_Cloud_Architect.pdf';
      const docType = 'certification';
      const docText = 'Google Cloud Certified Professional Cloud Architect. Experience with GCP, Kubernetes, and Terraform.';

      addDocumentToVault(docName, docType, docText);

      const cache = getVaultDocumentsCache();
      expect(cache.length).toBe(initialCount + 1);

      const added = cache.find(d => d.doc_name === docName);
      expect(added).toBeDefined();
      expect(added.doc_type).toBe('certification');
      expect(added.extracted_skills.map(s => s.toLowerCase())).toContain('gcp');
      expect(added.extracted_skills.map(s => s.toLowerCase())).toContain('kubernetes');

      const matrix = getVerifiedSkillsMatrix();
      expect(matrix.cloud.map(s => s.toLowerCase())).toContain('gcp');
      expect(matrix.cloud.map(s => s.toLowerCase())).toContain('kubernetes');
    });

    test('deleteVaultDocument removes document and triggers UI update', () => {
      const docName = 'Temporary_Credential.pdf';
      addDocumentToVault(docName, 'project', 'GraphQL API development with Node.js and PostgreSQL.');

      const cacheBefore = getVaultDocumentsCache();
      const targetDoc = cacheBefore.find(d => d.doc_name === docName);
      expect(targetDoc).toBeDefined();

      deleteVaultDocument(targetDoc.id);

      const cacheAfter = getVaultDocumentsCache();
      expect(cacheAfter.some(d => d.id === targetDoc.id)).toBe(false);
    });
  });

  describe('Vault UI Rendering', () => {
    test('renderVaultUI populates document list and updates pills', () => {
      renderVaultUI();

      const docsList = document.getElementById('vaultDocumentsList');
      const countPill = document.getElementById('vaultDocsCountBadge');
      const totalPill = document.getElementById('vaultDocTotalBadge');

      expect(docsList.children.length).toBeGreaterThan(0);
      expect(parseInt(countPill.textContent)).toBeGreaterThan(0);
      expect(totalPill.textContent).toContain('Files');
    });

    test('renderVaultUI categorizes skills into skill matrix pills', () => {
      renderVaultUI();

      const langEl = document.getElementById('vaultMatrixLanguages');
      const fwEl = document.getElementById('vaultMatrixFrameworks');
      const cloudEl = document.getElementById('vaultMatrixCloud');

      expect(langEl.children.length).toBeGreaterThan(0);
      expect(fwEl.children.length).toBeGreaterThan(0);
      expect(cloudEl.children.length).toBeGreaterThan(0);
    });

    test('renderVaultUI displays skills with logo centered on top and text below it', () => {
      renderVaultUI();

      const langEl = document.getElementById('vaultMatrixLanguages');
      expect(langEl.children.length).toBeGreaterThan(0);

      const firstTile = langEl.children[0];
      expect(firstTile.classList.contains('skill-matrix-tile')).toBe(true);

      const logoBox = firstTile.querySelector('.skill-logo-box');
      expect(logoBox).not.toBeNull();
      expect(logoBox.innerHTML).toContain('<svg');

      const labelSpan = firstTile.querySelector('span');
      expect(labelSpan).not.toBeNull();
      expect(labelSpan.textContent.trim().length).toBeGreaterThan(0);
    });

    test('getSkillLogoSvg returns dedicated brand SVGs for tech stack', () => {
      expect(getSkillLogoSvg('TypeScript')).toContain('3178C6');
      expect(getSkillLogoSvg('JavaScript')).toContain('F7DF1E');
      expect(getSkillLogoSvg('Python')).toContain('3776AB');
      expect(getSkillLogoSvg('React')).toContain('61DAFB');
      expect(getSkillLogoSvg('Docker')).toContain('2496ED');
      expect(getSkillLogoSvg('AWS Certified Solutions Architect', 'vaultMatrixCertifications')).toContain('FF9900');
    });
  });

  describe('Profile Synthesis & Workspace Sync', () => {
    test('syncVaultToWorkspace compiles vault highlights into resume textarea', () => {
      const resumeInput = document.getElementById('resumeText');
      expect(resumeInput.value).toBe('');

      syncVaultToWorkspace();

      expect(resumeInput.value).toContain('Candidate Profile Synthesized from Skill Vault');
      expect(resumeInput.value).toContain('Verified Technical Skills:');
      expect(resumeInput.value).toContain('React');
      expect(resumeInput.value).toContain('TypeScript');
      expect(resumeInput.value).toContain('Experience Highlights:');

      // Verifies workspace switched back to ATS tab
      const atsView = document.getElementById('ats-view');
      expect(atsView.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Autonomous Job Scout Pre-Scoring Against Vault', () => {
    test('calculateJobCompatibility uses vault profile when candidate resume is empty and includeVault is true', () => {
      const mockJob = {
        id: 'job-vault-test-1',
        title: 'Senior Full Stack Engineer',
        company_name: 'TechCorp',
        tags: ['React', 'TypeScript', 'Node.js', 'AWS', 'Docker'],
        description: 'Building modern cloud-native systems with React, Node.js, and AWS.'
      };

      // Empty resume text, but includeVault is true
      const resultWithVault = calculateJobCompatibility('', mockJob, true);

      expect(resultWithVault.isDefaultProfile).toBe(false);
      expect(resultWithVault.score).toBeGreaterThanOrEqual(75);
      expect(resultWithVault.label).toBe('Strong Match');
      expect(resultWithVault.matchingSkills).toContain('react');
      expect(resultWithVault.matchingSkills).toContain('typescript');
      expect(resultWithVault.matchingSkills).toContain('aws');
    });

    test('calculateJobCompatibility isolates manual resume when provided, without vault bleed', () => {
      const mockJob = {
        id: 'job-vault-test-2',
        title: 'Frontend Lead',
        tags: ['React', 'Next.js'],
        description: 'React expert needed.'
      };

      const manualResume = 'Data Scientist with Python and SQL experience.';
      const result = calculateJobCompatibility(manualResume, mockJob, true);

      // Even with includeVault true, explicit candidate text takes precedence
      expect(result.score).toBeLessThan(75);
      expect(result.matchingSkills).not.toContain('react');
    });
  });

  describe('Tab Navigation for Skill Vault', () => {
    test('switchWorkspaceTab switches cleanly to vault view', () => {
      switchWorkspaceTab('vault');

      const atsView = document.getElementById('ats-view');
      const discoveryView = document.getElementById('discovery-view');
      const vaultView = document.getElementById('vault-view');

      expect(atsView.classList.contains('hidden')).toBe(true);
      expect(discoveryView.classList.contains('hidden')).toBe(true);
      expect(vaultView.classList.contains('hidden')).toBe(false);
    });
  });

});
