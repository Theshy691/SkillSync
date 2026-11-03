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
  cycleDurations();
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

// 7. Interactive Hero Simulator Controller
function initHeroSimulator() {
  const pills = document.querySelectorAll(".hero-role-pill");
  const scoreVal = document.getElementById("heroScoreVal");
  const ringCircle = document.getElementById("heroRingCircle");
  const kwVal = document.getElementById("heroKwVal");
  const kwBar = document.getElementById("heroKwBar");
  const expVal = document.getElementById("heroExpVal");
  const expBar = document.getElementById("heroExpBar");
  const roleVal = document.getElementById("heroRoleVal");
  const focusBoard = document.querySelector(".focus-board");

  if (!pills.length || !scoreVal) return;

  let isHovered = false;

  const updateRole = (pill) => {
    pills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");

    const targetScore = parseInt(pill.dataset.score, 10) || 90;
    const targetKw = parseInt(pill.dataset.kw, 10) || 95;
    const targetExp = parseInt(pill.dataset.exp, 10) || 88;
    const roleName = pill.dataset.role || "Lead Full-Stack Eng";

    if (roleVal) roleVal.textContent = roleName;

    // Animate score counter
    animateCount(scoreVal, targetScore, "%", 700);

    // Animate SVG strokeDashoffset: circumference is ~314 (2 * PI * 50)
    if (ringCircle) {
      const offset = 314 - (314 * targetScore) / 100;
      ringCircle.style.transition = "stroke-dashoffset 0.7s ease";
      ringCircle.style.strokeDashoffset = offset;
    }

    // Update bars
    if (kwVal) kwVal.textContent = `${targetKw}%`;
    if (kwBar) kwBar.style.setProperty("--fill", `${targetKw}%`);
    if (expVal) expVal.textContent = `${targetExp}%`;
    if (expBar) expBar.style.setProperty("--fill", `${targetExp}%`);
  };

  pills.forEach((pill) => {
    pill.addEventListener("click", () => updateRole(pill));
  });

  if (focusBoard) {
    focusBoard.addEventListener("mouseenter", () => { isHovered = true; });
    focusBoard.addEventListener("mouseleave", () => { isHovered = false; });
  }

  // Initial radial stroke setup
  if (ringCircle) {
    ringCircle.style.transition = "stroke-dashoffset 1.2s ease";
    setTimeout(() => {
      ringCircle.style.strokeDashoffset = 314 - (314 * 94) / 100;
    }, 200);
  }

  // Auto-cycle roles every 4.2 seconds unless hovered
  let activeIndex = 0;
  window.setInterval(() => {
    if (isHovered) return;
    activeIndex = (activeIndex + 1) % pills.length;
    updateRole(pills[activeIndex]);
  }, 4200);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getPreferredTheme,
    updateThemeButton,
    applyThemeGlobal,
    animateCount,
    initAppPreview
  };
}

