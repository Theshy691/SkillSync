/**
 * @jest-environment jsdom
 */

const {
  performSignOut,
  initAuthForm
} = require('../script.js');

describe('Sign Out Confirmation Workflow Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="authHeaderContainer">
        <div id="userProfile">
          <span id="userEmailBadge">user@example.com</span>
          <button id="logoutBtn">Sign Out</button>
        </div>
        <button id="loginTriggerBtn">Sign In</button>
      </div>

      <div id="logout-modal" class="hidden">
        <button id="closeLogoutModalBtn"></button>
        <h3>Sign Out?</h3>
        <p>Are you sure you want to log out?</p>
        <button id="cancelLogoutBtn">Cancel</button>
        <button id="confirmLogoutBtn">Sign Out</button>
      </div>

      <div id="toast-container"></div>
    `;

    // Seed active session
    localStorage.setItem('skillsync_demo_session', JSON.stringify({
      user: { email: 'user@example.com' }
    }));
  });

  test('clicking Sign Out displays the confirmation modal without immediate logout', () => {
    initAuthForm();

    const logoutBtn = document.getElementById('logoutBtn');
    const modal = document.getElementById('logout-modal');

    expect(modal.classList.contains('hidden')).toBe(true);
    expect(localStorage.getItem('skillsync_demo_session')).toBeTruthy();

    logoutBtn.click();

    expect(modal.classList.contains('hidden')).toBe(false);
    // Session is still active
    expect(localStorage.getItem('skillsync_demo_session')).toBeTruthy();
  });

  test('clicking Cancel hides the confirmation modal and preserves the active session', () => {
    initAuthForm();

    const logoutBtn = document.getElementById('logoutBtn');
    const modal = document.getElementById('logout-modal');
    const cancelBtn = document.getElementById('cancelLogoutBtn');

    logoutBtn.click();
    expect(modal.classList.contains('hidden')).toBe(false);

    cancelBtn.click();
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(localStorage.getItem('skillsync_demo_session')).toBeTruthy();
  });

  test('clicking Close button hides the modal without signing out', () => {
    initAuthForm();

    const logoutBtn = document.getElementById('logoutBtn');
    const modal = document.getElementById('logout-modal');
    const closeBtn = document.getElementById('closeLogoutModalBtn');

    logoutBtn.click();
    expect(modal.classList.contains('hidden')).toBe(false);

    closeBtn.click();
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(localStorage.getItem('skillsync_demo_session')).toBeTruthy();
  });

  test('confirming sign out closes the modal, clears session storage, and updates UI state', async () => {
    initAuthForm();

    const logoutBtn = document.getElementById('logoutBtn');
    const modal = document.getElementById('logout-modal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');

    logoutBtn.click();
    expect(modal.classList.contains('hidden')).toBe(false);

    await confirmBtn.click();

    expect(modal.classList.contains('hidden')).toBe(true);
    expect(localStorage.getItem('skillsync_demo_session')).toBeNull();
  });

  test('falls back to window.confirm when logout modal is not present in DOM', async () => {
    // Remove modal from DOM
    document.getElementById('logout-modal').remove();

    const originalConfirm = window.confirm;
    window.confirm = jest.fn();

    initAuthForm();
    const logoutBtn = document.getElementById('logoutBtn');

    // Case 1: User cancels in window.confirm
    window.confirm.mockReturnValueOnce(false);
    logoutBtn.click();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('log out'));
    expect(localStorage.getItem('skillsync_demo_session')).toBeTruthy();

    // Case 2: User confirms in window.confirm
    window.confirm.mockReturnValueOnce(true);
    await logoutBtn.click();
    expect(localStorage.getItem('skillsync_demo_session')).toBeNull();

    window.confirm = originalConfirm;
  });
});

