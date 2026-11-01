/**
 * @jest-environment jsdom
 */

const {
  generateOutreachDrafts,
  updateOutreachCharCounter,
  renderOutreachDraft,
  openOutreachModal,
  initLinkedInOutreach,
  getActiveOutreachType
} = require('../script.js');

describe('LinkedIn Cold Outreach Generator Test Suite', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="outreach-modal" class="hidden">
        <button id="closeOutreachModalBtn"></button>
        <button class="outreach-type-btn" data-type="connect"></button>
        <button class="outreach-type-btn" data-type="inmail"></button>
        <button class="outreach-type-btn" data-type="coffee"></button>
        <span id="outreachCharCounter"></span>
        <textarea id="outreachMessageText"></textarea>
        <button id="copyOutreachBtn"></button>
        <button id="closeOutreachBtnBottom"></button>
      </div>
      <button id="linkedinOutreachBtn"></button>
      <textarea id="jobText"></textarea>
      <div id="toast-container"></div>
    `;
  });

  describe('Outreach Draft Synthesis', () => {
    test('generates compliant LinkedIn connection note strictly within 300 characters limit', () => {
      const drafts = generateOutreachDrafts({
        company: 'Stripe',
        title: 'Backend Engineer',
        skills: ['Node.js', 'PostgreSQL', 'Redis']
      });

      expect(drafts.connect).toBeTruthy();
      expect(drafts.connect.length).toBeLessThanOrEqual(300);
      expect(drafts.connect).toContain('Stripe');
      expect(drafts.inmail).toContain('Backend Engineer');
      expect(drafts.coffee).toContain('virtual coffee');
    });

    test('updateOutreachCharCounter tracks length and assigns styling thresholds', () => {
      updateOutreachCharCounter('Short note', 'connect');
      const counter = document.getElementById('outreachCharCounter');
      expect(counter.textContent).toBe('10 / 300');
      expect(counter.className).toContain('text-emerald');

      // Warning threshold > 260
      const longNote = 'a'.repeat(270);
      updateOutreachCharCounter(longNote, 'connect');
      expect(counter.textContent).toBe('270 / 300');
      expect(counter.className).toContain('text-amber');

      // Overflow threshold > 300
      const overNote = 'a'.repeat(305);
      updateOutreachCharCounter(overNote, 'connect');
      expect(counter.textContent).toBe('305 / 300');
      expect(counter.className).toContain('text-rose');
    });
  });

  describe('Modal Integration & UI Switching', () => {
    test('openOutreachModal displays modal and populates connect draft', () => {
      document.getElementById('jobText').value = 'Role: Staff Platform Engineer at Airbnb';
      openOutreachModal();

      const modal = document.getElementById('outreach-modal');
      expect(modal.classList.contains('hidden')).toBe(false);

      const textarea = document.getElementById('outreachMessageText');
      expect(textarea.value).toContain('Airbnb');
      expect(textarea.value.length).toBeLessThanOrEqual(300);
    });

    test('initLinkedInOutreach switches between connection, inmail, and coffee drafts', () => {
      initLinkedInOutreach();
      openOutreachModal({ company: 'Figma', title: 'Frontend Engineer' });

      const inmailBtn = document.querySelector('.outreach-type-btn[data-type="inmail"]');
      inmailBtn.click();

      const textarea = document.getElementById('outreachMessageText');
      expect(textarea.value).toContain('open Frontend Engineer position');

      const coffeeBtn = document.querySelector('.outreach-type-btn[data-type="coffee"]');
      coffeeBtn.click();
      expect(textarea.value).toContain('virtual coffee');
    });
  });
});

