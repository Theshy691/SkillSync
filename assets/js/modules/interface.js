/* Shared navigation and theme behavior for every SkillSync page. */
(function (root) {
  'use strict';
  const readTheme = () => {
    try {
      const saved = localStorage.getItem('skillsync_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return root.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  function applyTheme(theme, persist = true) {
    const dark = theme === 'dark';
    const value = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = value;
    document.documentElement.classList.toggle('dark', dark);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.dataset.themeState = value;
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      const label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = dark ? 'Dark mode' : 'Light mode';
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#111b18' : '#f5f7f6';
    if (persist) {
      try { localStorage.setItem('skillsync_theme', value); localStorage.setItem('ff-theme', value); } catch (_) {}
    }
  }
  function init() {
    applyTheme(document.documentElement.dataset.theme || readTheme(), false);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      if (button.dataset.interfaceBound) return;
      button.dataset.interfaceBound = 'true';
      button.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    });
    const menu = document.getElementById('marketingLinks');
    const toggle = document.getElementById('marketingMenuBtn');
    if (!menu || !toggle || toggle.dataset.interfaceBound) return;
    toggle.dataset.interfaceBound = 'true';
    const setOpen = open => {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    root.matchMedia?.('(min-width: 961px)').addEventListener('change', () => setOpen(false));
  }
  function initDialogs() {
    let active = null;
    let returnFocus = null;
    let overflow = '';
    const backgrounds = [...document.querySelectorAll('main,.site-header')];
    const originalInert = backgrounds.map(element => element.inert);
    const visible = element => element.getClientRects().length > 0;
    const focusable = card => [...card.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(visible);
    const sync = () => {
      const dialogs = [...document.querySelectorAll('.workspace-modal-card,.discovery-modal-box')].filter(visible);
      const next = dialogs[dialogs.length - 1] || null;
      if (next === active) return;
      if (next) {
        if (!active) { returnFocus = document.activeElement; overflow = document.body.style.overflow; }
        next.setAttribute('role', 'dialog');
        next.setAttribute('aria-modal', 'true');
        const title = next.querySelector('h2,h3');
        if (title) {
          if (!title.id) title.id = (next.parentElement.id || 'skillsync') + '-title';
          next.setAttribute('aria-labelledby', title.id);
        }
        document.body.style.overflow = 'hidden';
        backgrounds.forEach(element => { element.inert = true; });
        active = next;
        const target = focusable(next)[0] || next;
        if (target === next) next.tabIndex = -1;
        target.focus({ preventScroll: true });
      } else {
        active = null;
        document.body.style.overflow = overflow;
        backgrounds.forEach((element, index) => { element.inert = originalInert[index]; });
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      }
    };
    new MutationObserver(mutations => {
      if (mutations.some(({ target }) => target.matches?.('[id$="-modal"],#jobDetailModal') || target.closest?.('.workspace-modal-card,.discovery-modal-box'))) sync();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    document.addEventListener('keydown', event => {
      if (!active) return;
      if (event.key === 'Escape') {
        const close = active.querySelector('button[aria-label^="Close"],button[title^="Close"],button[id^="cancel"]');
        if (close) { event.preventDefault(); event.stopPropagation(); close.click(); }
      }
      if (event.key === 'Tab') {
        const items = focusable(active);
        if (!items.length) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
      }
    }, true);
    sync();
  }
  root.SkillSyncInterface = { applyTheme, init };
  applyTheme(readTheme(), false);
  document.addEventListener('DOMContentLoaded', () => { init(); initDialogs(); });
  root.addEventListener('storage', event => { if (event.key === 'skillsync_theme') applyTheme(readTheme(), false); });
})(window);
