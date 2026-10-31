/**
 * SkillSync - Theme Controller Unit Tests
 * File: tests/theme.test.js
 *
 * @jest-environment jsdom
 */

const { applyTheme, toggleTheme } = require('../script');

describe('Theme Controller Module Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="themeToggle" data-theme-state="dark">
        <span id="themeToggleLabel">Dark mode</span>
        <svg id="sunIcon" class="hidden"></svg>
        <svg id="moonIcon"></svg>
      </button>
    `;
    localStorage.clear();
    document.documentElement.className = '';
  });

  test('applyTheme properly toggles dark class and syncs dataset attributes', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('skillsync_theme')).toBe('dark');
    expect(localStorage.getItem('ff-theme')).toBe('dark');

    const toggle = document.getElementById('themeToggle');
    expect(toggle.dataset.themeState).toBe('dark');
  });

  test('applyTheme properly configures light mode', () => {
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('skillsync_theme')).toBe('light');

    const toggle = document.getElementById('themeToggle');
    expect(toggle.dataset.themeState).toBe('light');
  });

  test('toggleTheme alternates between dark and light modes', () => {
    applyTheme('light');
    toggleTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    toggleTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
