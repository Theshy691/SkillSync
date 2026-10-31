/**
 * SkillSync - Theme Management & Sync Module
 * File: assets/js/modules/theme.js
 */

export function initTheme() {
  const storedTheme = localStorage.getItem('skillsync_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme ? storedTheme : (prefersDark ? 'dark' : 'light');

  applyTheme(initialTheme);

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }
}

export function applyTheme(theme) {
  const html = document.documentElement;
  const sunIcon = document.getElementById('sunIcon');
  const moonIcon = document.getElementById('moonIcon');
  const toggleBtn = document.getElementById('themeToggle');
  const toggleLabel = document.getElementById('themeToggleLabel');

  html.setAttribute('data-theme', theme);

  if (theme === 'dark') {
    html.classList.add('dark');
    localStorage.setItem('skillsync_theme', 'dark');
    localStorage.setItem('ff-theme', 'dark');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
    if (toggleBtn) toggleBtn.dataset.themeState = 'dark';
    if (toggleLabel) toggleLabel.textContent = 'Dark mode';
  } else {
    html.classList.remove('dark');
    localStorage.setItem('skillsync_theme', 'light');
    localStorage.setItem('ff-theme', 'light');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
    if (toggleBtn) toggleBtn.dataset.themeState = 'light';
    if (toggleLabel) toggleLabel.textContent = 'Light mode';
  }
}

export function toggleTheme(forceTheme) {
  if (forceTheme) {
    applyTheme(forceTheme);
    return;
  }
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}
