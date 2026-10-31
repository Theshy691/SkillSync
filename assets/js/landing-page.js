/**
 * SkillSync - Interactive Landing Page Logic
 * Pixel-accurate implementation matching FortiFocus design system
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

// 4. Hero Counter Animations
function animateCount(element, target, suffix = "", duration = 1800) {
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

function initHeroStats(heroStats) {
  if (!heroStats) return;
  let countersStarted = false;

  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || countersStarted) return;
      countersStarted = true;

      animateCount(document.getElementById("counterScans"), 14820, "+");
      animateCount(document.getElementById("counterKeywords"), 450000, "+");
      animateCount(document.getElementById("counterGaps"), 8200, "+");

      const rateElement = document.getElementById("counterRate");
      if (!rateElement) return;

      let rate = 0;
      const intervalId = window.setInterval(() => {
        rate = Math.min(rate + 1, 92);
        rateElement.textContent = `${rate}%`;
        if (rate >= 92) {
          window.clearInterval(intervalId);
        }
      }, 16);
    });
  }, { threshold: 0.25 });

  heroObserver.observe(heroStats);
}

// 5. Interactive Cycle Durations
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

// 6. Streak / Activity Grid
const activeDays = [
  0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24,
  25, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 41
];

function buildStreakGrid() {
  const container = document.querySelector(".streak-showcase");
  if (!container || container.children.length > 0) return;

  for (let index = 0; index < 42; index += 1) {
    const day = document.createElement("div");
    day.className = `s-day${activeDays.includes(index) ? " active" : ""}${index === 41 ? " today" : ""}`;
    container.appendChild(day);
  }
}

// 7. Interactive App Preview Modal
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

// 8. Initialize Landing Page Components
document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const themeBtn = document.getElementById("themeBtn");
  const themeBtnLabel = document.getElementById("themeBtnLabel");
  const siteNav = document.getElementById("siteNav");
  const pageProgress = document.getElementById("pageProgress");
  const heroStats = document.querySelector(".hero-stats");
  const revealObserverTargets = document.querySelectorAll(".reveal, .animate-on-view");

  initLandingTheme({ root, themeBtn, themeBtnLabel });
  initScrollUI({ siteNav, pageProgress });
  initReveal(revealObserverTargets);
  initHeroStats(heroStats);
  cycleDurations();
  buildStreakGrid();
  initAppPreview();
});

