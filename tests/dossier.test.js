/**
 * @jest-environment jsdom
 */

const {
  generateCompanyDossier,
  renderCompanyDossier,
  openDossierModal,
  initCompanyDossier
} = require('../script.js');

describe('Company Research & Interview Intelligence Dossier Test Suite', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="dossier-modal" class="hidden">
        <button id="closeDossierModalBtn"></button>
        <h3 id="dossierCompanyTitle"></h3>
        <p id="dossierRoleSubtitle"></p>
        <div id="dossierTechStackTags"></div>
        <ul id="dossierTalkingPointsList"></ul>
        <ul id="dossierInterviewerQuestionsList"></ul>
        <button id="closeDossierBtnBottom"></button>
      </div>
      <button id="companyDossierBtn"></button>
      <textarea id="jobText"></textarea>
    `;
  });

  describe('Dossier Synthesis Algorithm', () => {
    test('synthesizes tech stack, strategic talking points, and interview questions for target role', () => {
      const jobInfo = {
        company: 'Figma',
        title: 'Senior Systems Engineer',
        description: 'Seeking engineer experienced in Rust, WebAssembly, TypeScript, and distributed systems.'
      };

      const dossier = generateCompanyDossier(jobInfo);

      expect(dossier.company).toBe('Figma');
      expect(dossier.title).toBe('Senior Systems Engineer');
      expect(dossier.techStack).toContain('TypeScript');
      expect(dossier.talkingPoints.length).toBe(4);
      expect(dossier.talkingPoints.some(pt => pt.includes('Figma'))).toBe(true);
      expect(dossier.questionsToAsk.length).toBe(4);
      expect(dossier.questionsToAsk.some(q => q.includes('Figma'))).toBe(true);
    });

    test('handles string company name gracefully and defaults stack', () => {
      const dossier = generateCompanyDossier('Stripe');
      expect(dossier.company).toBe('Stripe');
      expect(dossier.title).toBe('Software Engineer');
      expect(dossier.techStack.length).toBeGreaterThan(0);
    });
  });

  describe('UI Rendering & Modal Lifecycle', () => {
    test('renderCompanyDossier populates tags and questions in DOM', () => {
      const dossier = generateCompanyDossier({
        company: 'Vercel',
        title: 'Platform Engineer',
        description: 'Next.js, Edge Runtime, TypeScript, AWS'
      });

      renderCompanyDossier(dossier);

      expect(document.getElementById('dossierCompanyTitle').textContent).toContain('Vercel Intelligence Dossier');
      expect(document.getElementById('dossierRoleSubtitle').textContent).toContain('Platform Engineer');
      expect(document.getElementById('dossierTechStackTags').children.length).toBeGreaterThan(0);
      expect(document.getElementById('dossierTalkingPointsList').children.length).toBe(4);
      expect(document.getElementById('dossierInterviewerQuestionsList').children.length).toBe(4);
    });

    test('openDossierModal unhides modal and infers company from job textarea', () => {
      document.getElementById('jobText').value = 'Senior Cloud Architect at Datadog working on Kubernetes and Go.';
      openDossierModal();

      const modal = document.getElementById('dossier-modal');
      expect(modal.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('dossierCompanyTitle').textContent).toContain('Datadog');
    });

    test('initCompanyDossier wires open and close event listeners', () => {
      initCompanyDossier();
      const openBtn = document.getElementById('companyDossierBtn');
      const closeBtn = document.getElementById('closeDossierModalBtn');
      const modal = document.getElementById('dossier-modal');

      openBtn.click();
      expect(modal.classList.contains('hidden')).toBe(false);

      closeBtn.click();
      expect(modal.classList.contains('hidden')).toBe(true);
    });
  });
});
