/**
 * SkillSync - Toast Notification System Unit Tests
 * File: tests/toast.test.js
 *
 * @jest-environment jsdom
 */

const { showToast } = require('../script');

describe('Toast Notification System Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="toast-container"></div>
    `;
    jest.clearAllMocks();
  });

  test('dispatches success toast with emerald background and icon', () => {
    const toast = showToast('Resume scan complete!', 'success');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Resume scan complete!');
    expect(toast.className).toContain('emerald');
  });

  test('dispatches rate-limit warning toast with amber styling', () => {
    const toast = showToast('Rate limit: 5 req/min exceeded', 'warning');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Rate limit');
    expect(toast.className).toContain('amber');
  });

  test('dispatches error toast with rose styling', () => {
    const toast = showToast('Network connection failed', 'error');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Network connection failed');
    expect(toast.className).toContain('rose');
  });

  test('returns null if toast-container is missing from DOM', () => {
    document.body.innerHTML = '';
    const toast = showToast('Orphaned toast', 'info');
    expect(toast).toBeNull();
  });
});
