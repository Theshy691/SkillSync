/**
 * @jest-environment jsdom
 */

const {
  validatePersonName,
  validateVersionName,
  validateLocationName,
  initAuthForm,
  saveResumeVersion,
  getResumeVersions,
  setResumeVersions
} = require('../script.js');

describe('Input Validation & Error Handling Test Suite', () => {
  describe('Person Name Validation', () => {
    test('accepts valid human names with spaces, hyphens, and apostrophes', () => {
      expect(validatePersonName('James Sarmiento').valid).toBe(true);
      expect(validatePersonName('Mary-Jane Watson').valid).toBe(true);
      expect(validatePersonName("O'Connor").valid).toBe(true);
      expect(validatePersonName('José García').valid).toBe(true);
      expect(validatePersonName('Jean-Luc Picard').valid).toBe(true);
    });

    test('strictly rejects names containing numeric digits', () => {
      const res1 = validatePersonName('James123');
      expect(res1.valid).toBe(false);
      expect(res1.error).toBe('Name cannot contain numbers.');

      const res2 = validatePersonName('User 2026');
      expect(res2.valid).toBe(false);
      expect(res2.error).toBe('Name cannot contain numbers.');

      const res3 = validatePersonName('42');
      expect(res3.valid).toBe(false);
      expect(res3.error).toBe('Name cannot contain numbers.');
    });

    test('rejects names with special symbols or malicious injections', () => {
      const res1 = validatePersonName('James@Home');
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('can only contain letters');

      const res2 = validatePersonName('<script>alert()</script>');
      expect(res2.valid).toBe(false);
    });

    test('rejects empty, whitespace-only, or single-character names', () => {
      expect(validatePersonName('').valid).toBe(false);
      expect(validatePersonName('   ').valid).toBe(false);
      expect(validatePersonName('A').valid).toBe(false);
      expect(validatePersonName(null).valid).toBe(false);
      expect(validatePersonName(123).valid).toBe(false);
    });
  });

  describe('Resume Version Name Validation', () => {
    test('accepts valid descriptive version titles', () => {
      expect(validateVersionName('Full-Stack Specialist').valid).toBe(true);
      expect(validateVersionName('Cloud & DevOps Lead').valid).toBe(true);
      expect(validateVersionName('Backend v2').valid).toBe(true);
    });

    test('rejects purely numeric version names', () => {
      const res = validateVersionName('123456');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Version name cannot be purely numeric.');
    });

    test('rejects empty or symbol-only version names', () => {
      expect(validateVersionName('').valid).toBe(false);
      expect(validateVersionName('!@#$%').valid).toBe(false);
    });

    test('saveResumeVersion rejects invalid version names and returns null', () => {
      const initialCount = getResumeVersions().length;
      const result = saveResumeVersion('999999', 'Sample resume text');

      expect(result).toBeNull();
      expect(getResumeVersions().length).toBe(initialCount);
    });
  });

  describe('Location Name Validation', () => {
    test('accepts standard geographic and remote location names', () => {
      expect(validateLocationName('Remote').valid).toBe(true);
      expect(validateLocationName('San Francisco, CA').valid).toBe(true);
      expect(validateLocationName('London, UK').valid).toBe(true);
      expect(validateLocationName('').valid).toBe(true); // Optional
    });

    test('strictly rejects locations containing numbers', () => {
      const res1 = validateLocationName('San Francisco 123');
      expect(res1.valid).toBe(false);
      expect(res1.error).toBe('Location name cannot contain numbers.');

      const res2 = validateLocationName('New York 42');
      expect(res2.valid).toBe(false);
    });
  });

  describe('Interactive Real-Time DOM Error Messaging', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <form id="authForm">
          <div id="authNameContainer" class="hidden">
            <input type="text" id="authFullName" />
            <p id="authNameError" class="hidden"></p>
          </div>
          <input type="email" id="authEmail" />
          <input type="password" id="authPassword" />
          <button type="submit" id="authSubmitBtn">
            <span id="authSubmitText">Sign In</span>
          </button>
          <button type="button" id="authSwitchBtn"></button>
          <span id="authTitle"></span>
          <span id="authSubtitle"></span>
          <span id="authSwitchPrompt"></span>
        </form>
        <div id="toast-container"></div>
      `;
    });

    test('typing numbers into name input immediately reveals inline error', () => {
      initAuthForm();

      const nameInput = document.getElementById('authFullName');
      const errorMsg = document.getElementById('authNameError');

      // Type valid name
      nameInput.value = 'James';
      nameInput.dispatchEvent(new Event('input'));
      expect(errorMsg.classList.contains('hidden')).toBe(true);

      // Type number into name
      nameInput.value = 'James123';
      nameInput.dispatchEvent(new Event('input'));
      expect(errorMsg.classList.contains('hidden')).toBe(false);
      expect(errorMsg.textContent).toBe('Name cannot contain numbers.');

      // Fix name
      nameInput.value = 'James Sarmiento';
      nameInput.dispatchEvent(new Event('input'));
      expect(errorMsg.classList.contains('hidden')).toBe(true);
    });

    test('submitting registration with numeric name blocks submission and displays error', async () => {
      initAuthForm();

      // Switch to Sign Up mode
      const switchBtn = document.getElementById('authSwitchBtn');
      switchBtn.click();

      const nameContainer = document.getElementById('authNameContainer');
      expect(nameContainer.classList.contains('hidden')).toBe(false);

      const nameInput = document.getElementById('authFullName');
      const errorMsg = document.getElementById('authNameError');
      const emailInput = document.getElementById('authEmail');
      const passInput = document.getElementById('authPassword');
      const form = document.getElementById('authForm');

      nameInput.value = 'Tester99';
      emailInput.value = 'test@example.com';
      passInput.value = 'password123';

      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(errorMsg.classList.contains('hidden')).toBe(false);
      expect(errorMsg.textContent).toBe('Name cannot contain numbers.');
      expect(nameInput.classList.contains('border-rose-500')).toBe(true);
    });
  });
});

