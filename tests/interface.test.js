/** @jest-environment node */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const source = fs.readFileSync(require.resolve('../assets/js/modules/interface.js'), 'utf8');

function page(savedTheme) {
  const dom = new JSDOM(`<!doctype html><html data-theme="dark"><head><meta name="theme-color"></head><body>
    <header class="site-header"><button data-theme-toggle><span data-theme-label></span></button>
    <button id="marketingMenuBtn" aria-expanded="false"></button><nav id="marketingLinks"><a href="jobs.html">Jobs</a></nav></header>
    </body></html>`, { url: 'http://localhost:8000', runScripts: 'outside-only' });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {} });
  if (savedTheme) dom.window.localStorage.setItem('skillsync_theme', savedTheme);
  dom.window.eval(source);
  dom.window.SkillSyncInterface.init();
  return dom;
}

test('repeated page initializers do not attach multiple theme handlers', () => {
  const dom = page('light');
  try {
    const { document, SkillSyncInterface, localStorage } = dom.window;
    SkillSyncInterface.init(); SkillSyncInterface.init();
    document.querySelector('[data-theme-toggle]').click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('skillsync_theme')).toBe('dark');
    expect(document.querySelector('[data-theme-toggle]').getAttribute('aria-label')).toBe('Switch to light mode');
    expect(document.querySelector('[data-theme-label]').textContent).toBe('Dark mode');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#0e0e10');
  } finally { dom.window.close(); }
});

test('saved theme takes precedence over old page markup and stays synchronized', () => {
  const dom = page('light');
  try {
    const { document, localStorage, StorageEvent } = dom.window;
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    localStorage.setItem('skillsync_theme', 'dark');
    dom.window.dispatchEvent(new StorageEvent('storage', { key: 'skillsync_theme', newValue: 'dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  } finally { dom.window.close(); }
});

test('the shared mobile menu closes with Escape and returns focus to its trigger', () => {
  const dom = page('light');
  try {
    const { document, KeyboardEvent } = dom.window;
    const trigger = document.getElementById('marketingMenuBtn');
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  } finally { dom.window.close(); }
});
