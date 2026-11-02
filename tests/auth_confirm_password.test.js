/**
 * @jest-environment jsdom
 * @file tests/auth_confirm_password.test.js
 * Comprehensive unit test suite for the Create Account Confirm Password Feature
 */

const { initAuthForm, validatePasswordConfirmation } = require('../script.js');

describe('Create Account Confirm Password Test Suite', () => {
  let form, passInput, confirmInput, confirmContainer, confirmError, toggleBtn, switchBtn, tabSignUp, tabSignIn;

  beforeEach(() => {
    document.body.innerHTML = `
      <section id="auth-section">
        <button type="button" id="authTabSignIn">Sign In</button>
        <button type="button" id="authTabSignUp">Create Account</button>
        
        <h2 id="authTitle">Welcome to SkillSync</h2>
        <p id="authSubtitle">Sign in to access your saved resume evaluations</p>

        <form id="authForm">
          <div id="authNameContainer" class="hidden">
            <input type="text" id="authFullName" />
            <p id="authNameError" class="hidden"></p>
          </div>
          <input type="email" id="authEmail" />
          <input type="password" id="authPassword" />
          <button type="button" id="authTogglePasswordBtn">
            <svg id="authEyeIcon"></svg>
          </button>

          <div id="authConfirmPasswordContainer" class="hidden">
            <input type="password" id="authConfirmPassword" />
            <button type="button" id="authToggleConfirmPasswordBtn">
              <svg id="authEyeIconConfirm"></svg>
            </button>
            <p id="authConfirmPasswordError" class="hidden"></p>
          </div>

          <button type="submit" id="authSubmitBtn">
            <span id="authSubmitText">Sign In</span>
            <svg id="authSpinner" class="hidden"></svg>
          </button>
        </form>

        <span id="authSwitchPrompt">Don't have an account?</span>
        <button type="button" id="authSwitchBtn">Create one now</button>
        <div id="toast-container"></div>
      </section>
    `;

    localStorage.clear();
    initAuthForm();

    form = document.getElementById('authForm');
    passInput = document.getElementById('authPassword');
    confirmInput = document.getElementById('authConfirmPassword');
    confirmContainer = document.getElementById('authConfirmPasswordContainer');
    confirmError = document.getElementById('authConfirmPasswordError');
    toggleBtn = document.getElementById('authToggleConfirmPasswordBtn');
    switchBtn = document.getElementById('authSwitchBtn');
    tabSignUp = document.getElementById('authTabSignUp');
    tabSignIn = document.getElementById('authTabSignIn');
  });

  describe('Container & Visibility Behavior', () => {
    test('confirm password container is hidden in sign in mode and shown in sign up mode', () => {
      // Default: Sign in mode
      expect(confirmContainer.classList.contains('hidden')).toBe(true);

      // Switch to sign up mode via switch button
      switchBtn.click();
      expect(confirmContainer.classList.contains('hidden')).toBe(false);

      // Switch back to sign in mode
      switchBtn.click();
      expect(confirmContainer.classList.contains('hidden')).toBe(true);
    });

    test('switching between segmented tabs toggles confirm password container', () => {
      expect(confirmContainer.classList.contains('hidden')).toBe(true);

      tabSignUp.click();
      expect(confirmContainer.classList.contains('hidden')).toBe(false);

      tabSignIn.click();
      expect(confirmContainer.classList.contains('hidden')).toBe(true);
    });

    test('confirm password visibility toggle alternates between password and text', () => {
      expect(confirmInput.type).toBe('password');

      toggleBtn.click();
      expect(confirmInput.type).toBe('text');

      toggleBtn.click();
      expect(confirmInput.type).toBe('password');
    });

    test('switching back to sign in mode clears confirm password input and error', () => {
      // Enter sign up mode
      switchBtn.click();

      confirmInput.value = 'Mismatched123';
      confirmError.classList.remove('hidden');
      confirmInput.classList.add('border-rose-500');

      // Switch back to sign in
      switchBtn.click();
      expect(confirmInput.value).toBe('');
      expect(confirmError.classList.contains('hidden')).toBe(true);
      expect(confirmInput.classList.contains('border-rose-500')).toBe(false);
    });
  });

  describe('Real-Time Inline Match Validation', () => {
    beforeEach(() => {
      // Switch to Sign Up mode
      switchBtn.click();
    });

    test('shows inline error when confirm password does not match password', () => {
      passInput.value = 'SuperSecret123';
      passInput.dispatchEvent(new Event('input'));

      confirmInput.value = 'DifferentPass456';
      confirmInput.dispatchEvent(new Event('input'));

      expect(confirmError.classList.contains('hidden')).toBe(false);
      expect(confirmError.textContent).toBe('Passwords do not match.');
      expect(confirmInput.classList.contains('border-rose-500')).toBe(true);
    });

    test('clears inline error when confirm password matches password', () => {
      passInput.value = 'SuperSecret123';
      passInput.dispatchEvent(new Event('input'));

      // First type mismatch
      confirmInput.value = 'Mismatch';
      confirmInput.dispatchEvent(new Event('input'));
      expect(confirmError.classList.contains('hidden')).toBe(false);

      // Then type exact match
      confirmInput.value = 'SuperSecret123';
      confirmInput.dispatchEvent(new Event('input'));

      expect(confirmError.classList.contains('hidden')).toBe(true);
      expect(confirmInput.classList.contains('border-rose-500')).toBe(false);
    });

    test('re-validates match when user edits the original password field', () => {
      passInput.value = 'MatchPass123';
      passInput.dispatchEvent(new Event('input'));

      confirmInput.value = 'MatchPass123';
      confirmInput.dispatchEvent(new Event('input'));
      expect(confirmError.classList.contains('hidden')).toBe(true);

      // User changes original password
      passInput.value = 'NewPass999';
      passInput.dispatchEvent(new Event('input'));

      expect(confirmError.classList.contains('hidden')).toBe(false);
      expect(confirmError.textContent).toBe('Passwords do not match.');
      expect(confirmInput.classList.contains('border-rose-500')).toBe(true);
    });
  });

  describe('Form Submission Guardrails', () => {
    beforeEach(() => {
      // Switch to Sign Up mode
      switchBtn.click();
      document.getElementById('authFullName').value = 'James Sarmiento';
      document.getElementById('authEmail').value = 'james@example.com';
    });

    test('submitting with mismatched confirm password blocks submission and displays error', () => {
      passInput.value = 'SecurePassword1!';
      confirmInput.value = 'MismatchedPassword2!';

      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(confirmError.classList.contains('hidden')).toBe(false);
      expect(confirmError.textContent).toBe('Passwords do not match.');
      expect(confirmInput.classList.contains('border-rose-500')).toBe(true);
      // Ensure no demo session created on failure
      expect(localStorage.getItem('skillsync_demo_session')).toBeNull();
    });

    test('submitting with empty confirm password in sign-up mode blocks submission', () => {
      passInput.value = 'SecurePassword1!';
      confirmInput.value = '';

      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(confirmError.classList.contains('hidden')).toBe(false);
      expect(confirmError.textContent).toBe('Please confirm your password.');
      expect(confirmInput.classList.contains('border-rose-500')).toBe(true);
      expect(localStorage.getItem('skillsync_demo_session')).toBeNull();
    });

    test('submitting with matching confirm password allows account creation', (done) => {
      passInput.value = 'CorrectPassword1!';
      confirmInput.value = 'CorrectPassword1!';

      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(confirmError.classList.contains('hidden')).toBe(true);
      expect(confirmInput.classList.contains('border-rose-500')).toBe(false);

      // Verify completion after fallback timeout
      setTimeout(() => {
        const session = localStorage.getItem('skillsync_demo_session');
        expect(session).not.toBeNull();
        expect(JSON.parse(session).user.email).toBe('james@example.com');
        done();
      }, 350);
    });
  });
});
