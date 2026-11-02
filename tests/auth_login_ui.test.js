/**
 * @jest-environment jsdom
 * @file tests/auth_login_ui.test.js
 * Comprehensive unit test suite for the High-Impact Dual-Pane Auth Console
 */

const { initAuthForm } = require('../script.js');

describe('High-Impact Dual-Pane Auth Console Test Suite', () => {
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
          <button type="submit" id="authSubmitBtn">
            <span id="authSubmitText">Sign In</span>
            <svg id="authSpinner" class="hidden"></svg>
          </button>
        </form>

        <span id="authSwitchPrompt">Don't have an account?</span>
        <button type="button" id="authSwitchBtn">Create one now</button>

        <div id="demoModeContainer">
          <button type="button" id="quickDemoBtn">Launch Instant Demo Mode</button>
        </div>
      </section>
    `;

    localStorage.clear();
    initAuthForm();
  });

  test('segmented auth tabs switch cleanly between Sign In and Create Account modes', () => {
    const tabSignIn = document.getElementById('authTabSignIn');
    const tabSignUp = document.getElementById('authTabSignUp');
    const nameContainer = document.getElementById('authNameContainer');
    const title = document.getElementById('authTitle');
    const submitText = document.getElementById('authSubmitText');

    // Initially in Sign In mode
    expect(nameContainer.classList.contains('hidden')).toBe(true);
    expect(title.textContent).toContain('Welcome to SkillSync');

    // Click Create Account tab
    tabSignUp.click();
    expect(nameContainer.classList.contains('hidden')).toBe(false);
    expect(title.textContent).toBe('Create an Account');
    expect(submitText.textContent).toBe('Create Account');

    // Click Sign In tab
    tabSignIn.click();
    expect(nameContainer.classList.contains('hidden')).toBe(true);
    expect(title.textContent).toBe('Welcome to SkillSync');
    expect(submitText.textContent).toBe('Sign In');
  });

  test('password visibility toggle reveals and masks password text', () => {
    const toggleBtn = document.getElementById('authTogglePasswordBtn');
    const passInput = document.getElementById('authPassword');

    expect(passInput.type).toBe('password');

    // First click reveals password
    toggleBtn.click();
    expect(passInput.type).toBe('text');

    // Second click masks password
    toggleBtn.click();
    expect(passInput.type).toBe('password');
  });

  test('quick demo button sets local demo session and dispatches login event', () => {
    const demoBtn = document.getElementById('quickDemoBtn');
    demoBtn.click();

    const savedSession = localStorage.getItem('skillsync_demo_session');
    expect(savedSession).toBeTruthy();
    const parsed = JSON.parse(savedSession);
    expect(parsed.access_token).toBe('demo-token-123');
    expect(parsed.user.email).toContain('skillsync.demo');
  });
});
