/**
 * SkillSync - Interactive Landing Page Logic
 * Quiet Chrome Design System & Verifiable ATS Architecture
 */

// 1. Theme Controller (Syncs data-theme with Tailwind dark mode class)
function getPreferredTheme() {
  const savedTheme = localStorage.getItem("skillsync_theme") || localStorage.getItem("ff-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeButton(theme, themeBtn, themeBtnLabel) {
  if (!themeBtn || !themeBtnLabel) return;
  themeBtn.dataset.themeState = theme;
  themeBtnLabel.textContent = theme === "dark" ? "Dark mode" : "Light mode";
  themeBtn.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
}

function applyThemeGlobal(theme, root, themeBtn, themeBtnLabel) {
  root.setAttribute("data-theme", theme);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = theme === "dark" ? "#111b18" : "#f5f7f6";
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  updateThemeButton(theme, themeBtn, themeBtnLabel);
  localStorage.setItem("skillsync_theme", theme);
  localStorage.setItem("ff-theme", theme);
}

function initLandingTheme({ root, themeBtn, themeBtnLabel }) {
  if (window.SkillSyncInterface) { window.SkillSyncInterface.init(); return; }
  const applyCurrentTheme = (theme) => applyThemeGlobal(theme, root, themeBtn, themeBtnLabel);
  applyCurrentTheme(getPreferredTheme());

  if (!themeBtn) return;

  themeBtn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "dark";
    const nextTheme = current === "dark" ? "light" : "dark";
    applyCurrentTheme(nextTheme);
  });
}

// 2. Scroll UI & Reading Progress Bar
function initScrollUI({ siteNav, pageProgress }) {
  const updateScrollUI = () => {
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollRatio = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

    if (siteNav) {
      siteNav.classList.toggle("is-scrolled", scrollTop > 36);
    }
    if (pageProgress) {
      pageProgress.style.width = `${scrollRatio}%`;
    }
  };

  updateScrollUI();
  window.addEventListener("scroll", updateScrollUI, { passive: true });
  window.addEventListener("resize", updateScrollUI);
}

// 3. Scroll Reveal Animations (IntersectionObserver)
function initReveal(revealObserverTargets) {
  if (!revealObserverTargets || !revealObserverTargets.length) return;

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      if (entry.target.classList.contains("animate-on-view")) {
        entry.target.classList.add("is-live");
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  revealObserverTargets.forEach((element) => revealObserver.observe(element));
}

// 4. Interactive Cycle Durations
function cycleDurations() {
  const durationGroups = document.querySelectorAll(".dur-pills");
  durationGroups.forEach((group) => {
    const pills = Array.from(group.querySelectorAll(".dur-pill"));
    if (pills.length < 2) return;

    let activeIndex = pills.findIndex((pill) => pill.classList.contains("active"));
    activeIndex = activeIndex >= 0 ? activeIndex : 0;

    window.setInterval(() => {
      pills[activeIndex].classList.remove("active");
      activeIndex = (activeIndex + 1) % pills.length;
      pills[activeIndex].classList.add("active");
    }, 2200);
  });
}

// 6. Interactive App Preview Modal
function initAppPreview() {
  const modal = document.getElementById("appPreviewModal");
  const modalBody = document.getElementById("appPreviewBody");
  const modalTitle = document.getElementById("appPreviewTitle");
  const modalText = document.getElementById("appPreviewText");
  const closeButton = document.getElementById("appPreviewClose");
  const launchers = document.querySelectorAll(".preview-launch");

  if (!modal || !modalBody || !modalTitle || !modalText || !closeButton || !launchers.length) {
    return;
  }

  let activeLauncher = null;

  const closeModal = () => {
    modal.hidden = true;
    modalBody.replaceChildren();
    document.body.classList.remove("preview-open");
    if (activeLauncher) {
      activeLauncher.focus();
      activeLauncher = null;
    }
  };

  const openModal = (launcher) => {
    const templateId = launcher.getAttribute("data-preview-template");
    const title = launcher.getAttribute("data-preview-title") || "App Preview";
    const copy = launcher.getAttribute("data-preview-copy") || "";
    const template = templateId ? document.getElementById(templateId) : null;

    if (!template) return;

    activeLauncher = launcher;
    modalTitle.textContent = title;
    modalText.textContent = copy;
    modalBody.replaceChildren(template.content.cloneNode(true));
    modal.hidden = false;
    document.body.classList.add("preview-open");
    closeButton.focus();
  };

  launchers.forEach((launcher) => {
    launcher.addEventListener("click", () => openModal(launcher));
  });

  modal.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-preview-close]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
}

// 6. Initialize Landing Page Components
document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const themeBtn = document.getElementById("themeBtn");
  const themeBtnLabel = document.getElementById("themeBtnLabel");
  const siteNav = document.getElementById("siteNav");
  const pageProgress = document.getElementById("pageProgress");
  const revealObserverTargets = document.querySelectorAll(".reveal, .animate-on-view");

  initLandingTheme({ root, themeBtn, themeBtnLabel });
  initScrollUI({ siteNav, pageProgress });
  initReveal(revealObserverTargets);
  initHeroSimulator();
  initMarketingNavigation();
  initAppPreview();
});

// Helper for interactive simulation counters
function animateCount(element, target, suffix = "", duration = 700) {
  if (!element) return;
  let startTime = 0;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${Math.floor(eased * target).toLocaleString()}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// Sample controls respond only to the visitor; no unattended score cycling.
function initHeroSimulator() {
  const pills = document.querySelectorAll('.hero-role-pill');
  const details = {
    'Full-Stack Engineer': ['React & TypeScript', 'API development', 'Your web development experience aligns. Make your deployment experience easier to find.'],
    'Frontend Engineer': ['React & TypeScript', 'Accessible interfaces', 'Your interface work aligns. Add specific examples of how you test the experience.'],
    'Cloud Engineer': ['Docker & AWS', 'Deployment pipelines', 'Your infrastructure experience is relevant. Review the role’s orchestration requirements.']
  };
  pills.forEach(pill => pill.addEventListener('click', () => {
    pills.forEach(item => { item.classList.toggle('active', item === pill); item.setAttribute('aria-pressed', String(item === pill)); });
    const set = (id, text) => { const element = document.getElementById(id); if (element) element.textContent = text; };
    const role = pill.dataset.role;
    set('heroRoleVal', role);
    set('heroScoreVal', pill.dataset.score + '%');
    set('heroGapVal', pill.dataset.gap);
    set('heroSummaryTitle', Number(pill.dataset.score) >= 75 ? 'A strong starting point.' : 'A few areas to review.');
    const content = details[role];
    if (content) { set('heroSkillOne', content[0]); set('heroSkillTwo', content[1]); set('heroPreviewCopy', content[2]); }
  }));
}

function initMarketingNavigation() {
  if (window.SkillSyncInterface) return;
  const button = document.getElementById('marketingMenuBtn');
  const links = document.getElementById('marketingLinks');
  if (!button || !links) return;
  const setOpen = open => {
    links.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') { setOpen(false); button.focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('.marketing-nav')) setOpen(false); });
  window.matchMedia('(min-width: 801px)').addEventListener('change', () => setOpen(false));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getPreferredTheme,
    updateThemeButton,
    applyThemeGlobal,
    animateCount,
    initAppPreview,
    initMarketingNavigation,
    initHeroSimulator
  };
}

