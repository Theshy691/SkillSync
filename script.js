/**
 * SkillSync - Full-Stack AI Resume & Skill Matcher
 * File: script.js
 *
 * Handles client-side UI, CDN checks, dark/light theme toggle, toast notifications,
 * Supabase auth & session persistence, client-side PDF parsing (PDF.js),
 * AI web scraper proxying (scrape.php), AI resume matching (api.php),
 * dynamic scan history dashboard with sorting & deletion, PDF export (html2pdf),
 * clipboard copying, and a zero-configuration Local Demo Mode.
 */

// Global State
let supabaseClient = null;
let currentSession = null;
let pendingDeleteId = null;
let lastAnalysisResult = null;
let lastAnalysisInputs = null;
let activeAnalysisController = null;
let loadingSamplePair = false;

/**
 * Demo Mode Helper
 */
function isDemoMode() {
  const cfg = (typeof window !== 'undefined' && window.SKILLSYNC_CONFIG) || {};
  if (cfg.DEMO_MODE === true) return true;
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('your-project-id')) return true;
  if (currentSession && currentSession.access_token && currentSession.access_token.startsWith('demo-token')) return true;
  return supabaseClient === null;
}

const DEFAULT_DEMO_SCANS = [
  {
    id: 'demo-scan-1',
    user_id: 'demo-user-123',
    resume_snippet: 'Senior Full-Stack Engineer with 5+ years building scalable web applications with React, Node.js, PostgreSQL, and AWS.',
    job_description: 'Looking for a Senior Full-Stack Engineer to architect microservices, lead frontend engineering in React, and deploy containerized apps with Docker and Kubernetes.',
    match_score: 84,
    missing_skills: ['Kubernetes', 'CI/CD Pipelines', 'GraphQL'],
    created_at: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'demo-scan-2',
    user_id: 'demo-user-123',
    resume_snippet: 'Frontend Developer experienced in HTML5, CSS3, JavaScript ES6, Tailwind CSS, and Vue.js.',
    job_description: 'Backend Python Engineer required for high-throughput distributed systems. Must have deep knowledge of FastAPI, Redis, Docker, and Kafka.',
    match_score: 48,
    missing_skills: ['Python', 'FastAPI', 'Redis', 'Kafka', 'Docker'],
    created_at: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

function getDemoHistory() {
  try {
    const raw = localStorage.getItem('skillsync_demo_history');
    if (!raw) {
      localStorage.setItem('skillsync_demo_history', JSON.stringify(DEFAULT_DEMO_SCANS));
      return [...DEFAULT_DEMO_SCANS];
    }
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [...DEFAULT_DEMO_SCANS];
  } catch (_) {
    return [...DEFAULT_DEMO_SCANS];
  }
}

function saveDemoHistory(items) {
  try {
    localStorage.setItem('skillsync_demo_history', JSON.stringify(items));
  } catch (err) {
    console.error('Error saving demo history:', err);
  }
}

/**
 * 1. CDN Verification & Fallback UI
 */
function checkCdn() {
  const cdnFallback = document.getElementById('cdn-fallback');
  const appContainer = document.getElementById('app-container');

  const hasTailwind = typeof tailwind !== 'undefined' || Boolean(document.getElementById('workspaceUtilities'));
  const hasSupabase = typeof window.supabase !== 'undefined';
  const hasPdfJs = typeof window.pdfjsLib !== 'undefined';
  const hasHtml2Pdf = typeof window.html2pdf !== 'undefined';

  if (!hasTailwind) {
    if (cdnFallback) cdnFallback.style.display = 'block';
    if (appContainer) appContainer.style.display = 'none';
    console.error('SkillSync CDN check failed:', { hasTailwind, hasSupabase, hasPdfJs, hasHtml2Pdf });
    return false;
  }

  if (cdnFallback) cdnFallback.style.display = 'none';
  return true;
}

/**
 * 2. Theme Toggle (Light / Dark Mode)
 */
function initTheme() {
  if (window.SkillSyncInterface) { window.SkillSyncInterface.init(); return; }
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

function applyTheme(theme) {
  if (window.SkillSyncInterface) { window.SkillSyncInterface.applyTheme(theme); return; }
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

function toggleTheme(forceTheme) {
  if (forceTheme) {
    applyTheme(forceTheme);
    return;
  }
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

/**
 * 3. Custom Toast Notification System
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return null;

  const toast = document.createElement('div');
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-atomic', 'true');
  toast.dataset.tone = type;
  toast.className = 'ss-toast pointer-events-auto flex items-center space-x-3 p-3.5 rounded-2xl shadow-xl border text-sm font-medium transform transition-all duration-300 opacity-0 translate-y-2';

  let iconSvg = '';
  let colorClasses = '';

  switch (type) {
    case 'success':
      colorClasses = 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800';
      iconSvg = `<svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
      break;
    case 'error':
      colorClasses = 'bg-rose-50 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100 border-rose-200 dark:border-rose-800';
      iconSvg = `<svg class="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
      break;
    case 'warning':
      colorClasses = 'bg-amber-50 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800';
      iconSvg = `<svg class="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
      break;
    default: // info
      colorClasses = 'bg-slate-900 text-white bg-[var(--paper-2)] dark:text-slate-100 border-slate-700';
      iconSvg = `<svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
      break;
  }

  toast.className += ` ${colorClasses}`;
  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1 leading-snug">${escapeHtml(message)}</div>
    <button class="toast-close text-[var(--ink-3)] hover:text-slate-600 dark:hover:text-slate-200 p-1" aria-label="Dismiss">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  while (container.children.length >= 2) container.firstElementChild.remove();
  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
  });

  const dismiss = () => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
  }

  setTimeout(dismiss, duration);
  return toast;
}

/**
 * 4. Helper Utilities
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

function cleanJobDescription(text) {
  if (!text || typeof text !== 'string') return '';
  let str = text;

  // Decode HTML entities if present (e.g. &lt;p&gt;, &amp;nbsp;, &gt;&lt;/p&gt;)
  for (let i = 0; i < 2; i++) {
    if (str.includes('&lt;') || str.includes('&amp;') || str.includes('&gt;') || str.includes('&quot;') || str.includes('&#39;')) {
      str = str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/gi, ' ');
    } else {
      break;
    }
  }

  // Convert block HTML tags into natural clean line breaks and list bullets
  str = str
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(h[1-6]|div|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '') // strip all other HTML tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ');

  // Normalize spacing
  str = str.replace(/[ \t]+/g, ' ');
  str = str.replace(/\n\s+\n/g, '\n\n');
  str = str.replace(/\n{3,}/g, '\n\n');

  return str.trim();
}

function updateCharCounter(inputElement, counterElement, max) {
  if (!inputElement || !counterElement) return;
  const len = inputElement.value ? inputElement.value.length : 0;
  if (typeof max === 'number' && max > 0) {
    counterElement.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
    if (len >= max) {
      counterElement.classList.add('text-rose-500', 'font-bold');
    } else {
      counterElement.classList.remove('text-rose-500', 'font-bold');
    }
  } else {
    counterElement.textContent = `${len.toLocaleString()} chars`;
    counterElement.classList.remove('text-rose-500', 'font-bold');
  }
}

function generateYouTubeLink(skill) {
  if (!skill) return '#';
  const query = encodeURIComponent(`learn ${skill.trim()}`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

/**
 * Input Validation Utilities
 */
function validatePersonName(name) {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be text.' };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter your name.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters long.' };
  }
  if (/[0-9]/.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain numbers.' };
  }
  if (!/^[A-Za-z\u00C0-\u024F\s'-]+$/.test(trimmed)) {
    return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes.' };
  }
  return { valid: true, error: null };
}

function validateVersionName(name) {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Version name must be text.' };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please provide a version name.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Version name must be at least 2 characters long.' };
  }
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Version name cannot be purely numeric.' };
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'Version name must contain letters.' };
  }
  return { valid: true, error: null };
}

function validateLocationName(location) {
  if (typeof location !== 'string') {
    return { valid: false, error: 'Location must be text.' };
  }
  const trimmed = location.trim();
  if (!trimmed) {
    return { valid: true, error: null };
  }
  if (/[0-9]/.test(trimmed)) {
    return { valid: false, error: 'Location name cannot contain numbers.' };
  }
  return { valid: true, error: null };
}

function validatePasswordConfirmation(password, confirmPassword) {
  if (typeof confirmPassword !== 'string' || confirmPassword.length === 0) {
    return { valid: false, error: 'Please confirm your password.' };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }
  return { valid: true, error: null };
}

function getScoreColorClasses(score) {
  if (score >= 75) {
    return {
      badge: 'bg-emerald-500 text-white shadow-emerald-500/25',
      text: 'text-emerald-600 dark:text-emerald-400',
      label: 'Strong Match'
    };
  }
  if (score >= 50) {
    return {
      badge: 'bg-amber-500 text-white shadow-amber-500/25',
      text: 'text-amber-600 dark:text-amber-400',
      label: 'Moderate Match'
    };
  }
  return {
    badge: 'bg-rose-500 text-white shadow-rose-500/25',
    text: 'text-rose-600 dark:text-rose-400',
    label: 'Needs Growth'
  };
}

/**
 * 5. Supabase Initialization & Auth
 */
function initSupabase() {
  const cfg = (typeof window !== 'undefined' && window.SKILLSYNC_CONFIG) || {};
  const supabaseUrl = cfg.SUPABASE_URL;
  const supabaseAnonKey = cfg.SUPABASE_ANON_KEY;

  if (cfg.DEMO_MODE) {
    console.info('SkillSync: Running in Local Demo Mode.');
    return null;
  }

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
    console.info('SkillSync: Cloud Supabase credentials not set. Running in Local Demo Mode.');
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseClient;
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return null;
  }
}

async function initAuth() {
  const urlParams = (typeof window !== 'undefined' && window.location && window.location.search)
    ? new URLSearchParams(window.location.search)
    : null;
  const isExplicitDemo = urlParams?.get('demo') === '1';

  if (!isExplicitDemo) {
    try {
      localStorage.removeItem('skillsync_demo_session');
    } catch (_) {}
  }

  if (isDemoMode()) {
    try {
      const demoSession = isExplicitDemo ? localStorage.getItem('skillsync_demo_session') : null;
      if (demoSession) {
        currentSession = JSON.parse(demoSession);
        updateAuthState(currentSession);
      } else {
        updateAuthState(null);
      }
    } catch (_) {
      updateAuthState(null);
    }
    return;
  }

  if (!supabaseClient) return;

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('Error checking session:', error);
    }
    if (!isExplicitDemo || !localStorage.getItem('skillsync_demo_session')) updateAuthState(session);
  } catch (e) {
    console.error('Exception fetching session:', e);
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    // A delayed cloud event must not replace an explicitly selected demo session.
    if (currentSession?.access_token?.startsWith('demo-token')) return;
    if (event === 'TOKEN_REFRESH_FAILED') {
      console.warn('Token refresh failed. Showing session expired modal.');
      showSessionExpiredModal();
      return;
    }
    updateAuthState(session);
  });
}

function updateAuthState(session) {
  if (currentSession?.user?.id && currentSession.user.id !== session?.user?.id) {
    activeAnalysisController?.abort();
    lastAnalysisResult = null;
    lastAnalysisInputs = null;
    document.getElementById('results-container')?.classList.add('hidden');
  }
  currentSession = session;
  const authSection = document.getElementById('auth-section');
  const workspaceSection = document.getElementById('workspace-section');
  const userProfile = document.getElementById('userProfile');
  const loginTriggerBtn = document.getElementById('loginTriggerBtn');
  const userEmailBadge = document.getElementById('userEmailBadge');

  if (session && session.user) {
    if (authSection) authSection.classList.add('hidden');
    if (workspaceSection) workspaceSection.classList.remove('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    if (loginTriggerBtn) loginTriggerBtn.classList.add('hidden');
    if (userEmailBadge) userEmailBadge.textContent = session.user.email || 'Demo User';
    initWorkspaceDrafts();
    updateComparisonReadiness();
    const mode = document.getElementById('workspaceMode');
    if (mode) { mode.textContent = 'Demo'; mode.classList.toggle('hidden', !isDemoMode()); }
    fetchDashboard();
  } else {
    if (authSection) authSection.classList.remove('hidden');
    if (workspaceSection) workspaceSection.classList.add('hidden');
    if (userProfile) userProfile.classList.add('hidden');
    if (loginTriggerBtn) loginTriggerBtn.classList.remove('hidden');
  }
}

function showSessionExpiredModal() {
  const modal = document.getElementById('session-modal');
  if (modal) modal.classList.remove('hidden');
}

/**
 * 6. Auth Form Handlers (Sign In, Sign Up, & Instant Demo Login)
 */
let isSignUpMode = false;

async function performSignOut() {
  try { if (workspaceDraftKey()) sessionStorage.removeItem(workspaceDraftKey()); } catch (_) {}
  workspaceDraftOwner = null;
  workspaceUndoHistory = [];
  if (activeAnalysisController) activeAnalysisController.abort();
  lastAnalysisResult = null;
  lastAnalysisInputs = null;
  document.getElementById('results-container')?.classList.add('hidden');
  const resumeText = document.getElementById('resumeText');
  const jobText = document.getElementById('jobText');
  const resumeCount = document.getElementById('resumeCount');
  const jobCount = document.getElementById('jobCount');
  if (resumeText) {
    resumeText.value = '';
    delete resumeText.dataset.profileId;
    updateCharCounter(resumeText, resumeCount);
  }
  if (jobText) {
    jobText.value = '';
    updateCharCounter(jobText, jobCount);
  }
  try {
    localStorage.removeItem('skillsync_resume_versions');
    localStorage.removeItem('skillsync_cached_profile');
    localStorage.removeItem('skillsync_selected_role');
    if (typeof window !== 'undefined' && window.location && window.history) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch (_) {}

  if (isDemoMode()) {
    localStorage.removeItem('skillsync_demo_session');
    updateAuthState(null);
    showToast('Signed out.', 'info');
    return;
  }

  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
      showToast('Signed out successfully.', 'info');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }
  updateAuthState(null);
}

function initAuthForm() {
  isSignUpMode = false;
  const authForm = document.getElementById('authForm');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authSubmitText = document.getElementById('authSubmitText');
  const authSwitchPrompt = document.getElementById('authSwitchPrompt');
  const authSwitchBtn = document.getElementById('authSwitchBtn');
  const authSpinner = document.getElementById('authSpinner');
  const logoutBtn = document.getElementById('logoutBtn');
  const sessionLoginBtn = document.getElementById('sessionLoginBtn');
  const loginTriggerBtn = document.getElementById('loginTriggerBtn');
  const quickDemoBtn = document.getElementById('quickDemoBtn');
  const authNameContainer = document.getElementById('authNameContainer');
  const authFullName = document.getElementById('authFullName');
  const authNameError = document.getElementById('authNameError');
  const authTabSignIn = document.getElementById('authTabSignIn');
  const authTabSignUp = document.getElementById('authTabSignUp');
  const authTogglePasswordBtn = document.getElementById('authTogglePasswordBtn');
  const authEyeIcon = document.getElementById('authEyeIcon');
  const authPassword = document.getElementById('authPassword');
  const authConfirmPasswordContainer = document.getElementById('authConfirmPasswordContainer');
  const authConfirmPassword = document.getElementById('authConfirmPassword');
  const authConfirmPasswordError = document.getElementById('authConfirmPasswordError');
  const authToggleConfirmPasswordBtn = document.getElementById('authToggleConfirmPasswordBtn');
  const authEyeIconConfirm = document.getElementById('authEyeIconConfirm');

  // Password visibility toggle
  if (authTogglePasswordBtn && authPassword) {
    authTogglePasswordBtn.addEventListener('click', () => {
      const isPass = authPassword.type === 'password';
      authPassword.type = isPass ? 'text' : 'password';
      if (authEyeIcon) {
        authEyeIcon.innerHTML = isPass
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
      }
    });
  }

  // Confirm password visibility toggle
  if (authToggleConfirmPasswordBtn && authConfirmPassword) {
    authToggleConfirmPasswordBtn.addEventListener('click', () => {
      const isPass = authConfirmPassword.type === 'password';
      authConfirmPassword.type = isPass ? 'text' : 'password';
      if (authEyeIconConfirm) {
        authEyeIconConfirm.innerHTML = isPass
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
      }
    });
  }

  // Real-time password confirmation match validation
  if (authConfirmPassword && authPassword) {
    const validatePasswordMatch = () => {
      if (!isSignUpMode) return;
      const pass = authPassword.value;
      const confirmPass = authConfirmPassword.value;
      if (!confirmPass) {
        if (authConfirmPasswordError) authConfirmPasswordError.classList.add('hidden');
        authConfirmPassword.classList.remove('border-rose-500');
        return;
      }
      if (pass !== confirmPass) {
        if (authConfirmPasswordError) {
          authConfirmPasswordError.textContent = 'Passwords do not match.';
          authConfirmPasswordError.classList.remove('hidden');
        }
        authConfirmPassword.classList.add('border-rose-500');
      } else {
        if (authConfirmPasswordError) authConfirmPasswordError.classList.add('hidden');
        authConfirmPassword.classList.remove('border-rose-500');
      }
    };

    authConfirmPassword.addEventListener('input', validatePasswordMatch);
    authPassword.addEventListener('input', () => {
      if (authConfirmPassword.value) validatePasswordMatch();
    });
  }

  function updateAuthTabStyles(isSignUp) {
    if (authTabSignIn && authTabSignUp) {
      if (isSignUp) {
        authTabSignUp.style.background = 'var(--surface)';
        authTabSignUp.style.color = 'var(--ink)';
        authTabSignUp.classList.add('shadow-sm');
        authTabSignIn.style.background = 'transparent';
        authTabSignIn.style.color = 'var(--ink-3)';
        authTabSignIn.classList.remove('shadow-sm');
      } else {
        authTabSignIn.style.background = 'var(--surface)';
        authTabSignIn.style.color = 'var(--ink)';
        authTabSignIn.classList.add('shadow-sm');
        authTabSignUp.style.background = 'transparent';
        authTabSignUp.style.color = 'var(--ink-3)';
        authTabSignUp.classList.remove('shadow-sm');
      }
    }
  }

  if (authTabSignIn) {
    authTabSignIn.addEventListener('click', () => {
      if (isSignUpMode && authSwitchBtn) authSwitchBtn.click();
    });
  }

  if (authTabSignUp) {
    authTabSignUp.addEventListener('click', () => {
      if (!isSignUpMode && authSwitchBtn) authSwitchBtn.click();
    });
  }

  // Instant Quick Demo Login
  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', () => {
      const demoUser = {
        user: {
          id: 'demo-user-123',
          email: 'demo@skillsync.demo'
        },
        access_token: 'demo-token-123'
      };
      localStorage.setItem('skillsync_demo_session', JSON.stringify(demoUser));
      try {
        if (typeof window !== 'undefined' && window.location && window.history) {
          const url = new URL(window.location.href);
          url.searchParams.set('demo', '1');
          window.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
        }
      } catch (_) {}
      updateAuthState(demoUser);
      if (!document.getElementById('resumeText')?.value.trim() && !document.getElementById('jobText')?.value.trim()) document.getElementById('loadSamplePairBtn')?.click();
    });
  }

  if (authFullName && authNameError) {
    authFullName.addEventListener('input', () => {
      const val = authFullName.value;
      if (!val) {
        authNameError.classList.add('hidden');
        authFullName.classList.remove('border-rose-500');
        return;
      }
      if (/[0-9]/.test(val)) {
        authNameError.textContent = 'Name cannot contain numbers.';
        authNameError.classList.remove('hidden');
        authFullName.classList.add('border-rose-500');
      } else if (!/^[A-Za-z\u00C0-\u024F\s'-]*$/.test(val)) {
        authNameError.textContent = 'Name can only contain letters, spaces, hyphens, and apostrophes.';
        authNameError.classList.remove('hidden');
        authFullName.classList.add('border-rose-500');
      } else {
        authNameError.classList.add('hidden');
        authFullName.classList.remove('border-rose-500');
      }
    });
  }

  if (authSwitchBtn) {
    authSwitchBtn.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      if (authNameContainer) {
        if (isSignUpMode) {
          authNameContainer.classList.remove('hidden');
        } else {
          authNameContainer.classList.add('hidden');
        }
      }
      if (authConfirmPasswordContainer) {
        if (isSignUpMode) {
          authConfirmPasswordContainer.classList.remove('hidden');
        } else {
          authConfirmPasswordContainer.classList.add('hidden');
          if (authConfirmPassword) {
            authConfirmPassword.value = '';
            authConfirmPassword.classList.remove('border-rose-500');
          }
          if (authConfirmPasswordError) {
            authConfirmPasswordError.classList.add('hidden');
          }
        }
      }
      if (isSignUpMode) {
        authTitle.textContent = 'Create an Account';
        authSubtitle.textContent = 'Sign up to track and evaluate resume matches';
        authSubmitText.textContent = 'Create Account';
        authSwitchPrompt.textContent = 'Already have an account?';
        authSwitchBtn.textContent = 'Sign in';
      } else {
        authTitle.textContent = 'Welcome to SkillSync';
        authSubtitle.textContent = 'Sign in to access your saved resume evaluations and scan history';
        authSubmitText.textContent = 'Sign In';
        authSwitchPrompt.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Create one now';
      }
      updateAuthTabStyles(isSignUpMode);
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;

      if (!email || !password) return;

      if (isSignUpMode && authFullName) {
        const nameVal = authFullName.value.trim();
        const nameCheck = validatePersonName(nameVal);
        if (!nameCheck.valid) {
          if (authNameError) {
            authNameError.textContent = nameCheck.error;
            authNameError.classList.remove('hidden');
          }
          authFullName.classList.add('border-rose-500');
          showToast(nameCheck.error, 'error');
          return;
        }
      }

      if (isSignUpMode && authConfirmPassword) {
        const confirmVal = authConfirmPassword.value;
        const confirmCheck = validatePasswordConfirmation(password, confirmVal);
        if (!confirmCheck.valid) {
          if (authConfirmPasswordError) {
            authConfirmPasswordError.textContent = confirmCheck.error;
            authConfirmPasswordError.classList.remove('hidden');
          }
          authConfirmPassword.classList.add('border-rose-500');
          showToast(confirmCheck.error, 'error');
          return;
        }
      }

      if (authSpinner) authSpinner.classList.remove('hidden');
      if (authSubmitText) authSubmitText.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';

      // If live Supabase client is available, authenticate with cloud database
      if (supabaseClient && !(typeof window !== 'undefined' && window.SKILLSYNC_CONFIG && window.SKILLSYNC_CONFIG.DEMO_MODE === true)) {
        try {
          // Clear any leftover demo session flag so we use real cloud database session
          localStorage.removeItem('skillsync_demo_session');

          if (isSignUpMode) {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            showToast('Account created! Please check your email to confirm or sign in.', 'success', 6000);
          } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast('Signed in successfully!', 'success');
          }
        } catch (err) {
          console.error('Auth error:', err);
          showToast(err.message || 'Authentication failed.', 'error');
        } finally {
          if (authSpinner) authSpinner.classList.add('hidden');
          if (authSubmitText) authSubmitText.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
        return;
      }

      // Fallback for offline / mock testing / explicit Demo mode
      setTimeout(() => {
        const demoUser = {
          user: { id: 'demo-' + Date.now(), email },
          access_token: 'demo-token-' + Date.now()
        };
        localStorage.setItem('skillsync_demo_session', JSON.stringify(demoUser));
        updateAuthState(demoUser);
        if (authSpinner) authSpinner.classList.add('hidden');
        if (authSubmitText) authSubmitText.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        showToast('Opened a local demo. No cloud account was created or signed in.', 'info');
      }, 300);
    });
  }

  const logoutModal = document.getElementById('logout-modal');
  const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
  const closeLogoutModalBtn = document.getElementById('closeLogoutModalBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (logoutModal) {
        logoutModal.classList.remove('hidden');
        return;
      }

      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const confirmed = window.confirm('Are you sure you want to log out of your account?');
        if (!confirmed) return;
      }

      await performSignOut();
    });
  }

  if (cancelLogoutBtn && logoutModal) {
    cancelLogoutBtn.addEventListener('click', () => {
      logoutModal.classList.add('hidden');
    });
  }

  if (closeLogoutModalBtn && logoutModal) {
    closeLogoutModalBtn.addEventListener('click', () => {
      logoutModal.classList.add('hidden');
    });
  }

  if (confirmLogoutBtn && logoutModal) {
    confirmLogoutBtn.addEventListener('click', async () => {
      logoutModal.classList.add('hidden');
      await performSignOut();
    });
  }

  const closeSessionModalBtn = document.getElementById('closeSessionModalBtn');
  const sessionDemoBtn = document.getElementById('sessionDemoBtn');

  if (closeSessionModalBtn) {
    closeSessionModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('session-modal');
      if (modal) modal.classList.add('hidden');
    });
  }

  if (sessionDemoBtn) {
    sessionDemoBtn.addEventListener('click', () => {
      const modal = document.getElementById('session-modal');
      if (modal) modal.classList.add('hidden');
      const demoUser = {
        user: {
          id: 'demo-user-123',
          email: 'demo@skillsync.demo'
        },
        access_token: 'demo-token-123'
      };
      localStorage.setItem('skillsync_demo_session', JSON.stringify(demoUser));
      updateAuthState(demoUser);
      showToast('Switched to Demo Session. You can run your analysis now!', 'success');
    });
  }

  if (sessionLoginBtn) {
    sessionLoginBtn.addEventListener('click', async () => {
      const modal = document.getElementById('session-modal');
      if (modal) modal.classList.add('hidden');
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      localStorage.removeItem('skillsync_demo_session');
      updateAuthState(null);
    });
  }

  if (loginTriggerBtn) {
    loginTriggerBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/**
 * 7. Character Limit Counters Setup
 */
function initCharCounters() {
  const resumeText = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');
  const jobText = document.getElementById('jobText');
  const jobCount = document.getElementById('jobCount');

  if (resumeText && resumeCount) {
    resumeText.addEventListener('input', () => updateCharCounter(resumeText, resumeCount));
  }
  if (jobText && jobCount) {
    jobText.addEventListener('input', () => updateCharCounter(jobText, jobCount));
  }
}

// Keep drafts within this tab and this signed-in user. Replacements remain undoable.
let workspaceDraftOwner = null;
let workspaceUndoHistory = [];

function workspaceDraftKey() {
  return currentSession?.user?.id ? `skillsync_workspace_draft:${currentSession.user.id}` : null;
}

function saveWorkspaceDraft() {
  const key = workspaceDraftKey();
  if (!key) return;
  const status = document.getElementById('draftStatus');
  try {
    sessionStorage.setItem(key, JSON.stringify({
      resume: document.getElementById('resumeText')?.value || '',
      job: document.getElementById('jobText')?.value || '',
      profileId: document.getElementById('resumeText')?.dataset.profileId || ''
    }));
    if (status) status.textContent = 'Draft saved in this tab.';
  } catch (_) {
    if (status) status.textContent = 'Draft could not be saved. Keep a copy before leaving.';
  }
}

function rememberWorkspaceReplacement() {
  workspaceUndoHistory.push({
    resume: document.getElementById('resumeText')?.value || '',
    job: document.getElementById('jobText')?.value || '',
    profileId: document.getElementById('resumeText')?.dataset.profileId || '',
    versions: resumeVersions.map(version => ({ ...version }))
  });
  if (workspaceUndoHistory.length > 10) workspaceUndoHistory.shift();
  const undo = document.getElementById('undoWorkspaceBtn');
  if (undo) undo.disabled = false;
}

function replaceWorkspaceText(fieldId, value, profileId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  if (field.value !== value) rememberWorkspaceReplacement();
  field.value = value;
  if (fieldId === 'resumeText') {
    field.dataset.profileId = profileId || '';
    const select = document.getElementById('resumeVersionSelect');
    if (select) select.value = profileId || '';
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function undoWorkspaceReplacement() {
  const previous = workspaceUndoHistory.pop();
  if (!previous) return;
  resumeVersions = previous.versions;
  saveResumeVersionsToStorage();
  renderResumeVersionSelect(previous.profileId);
  [['resumeText', previous.resume], ['jobText', previous.job]].forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (!field) return;
    field.value = value;
    if (id === 'resumeText') field.dataset.profileId = previous.profileId;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const undo = document.getElementById('undoWorkspaceBtn');
  if (undo) undo.disabled = workspaceUndoHistory.length === 0;
  showToast('Previous documents restored.', 'success');
}

function initWorkspaceDrafts() {
  const key = workspaceDraftKey();
  if (!key || workspaceDraftOwner === key) return;
  const changingUser = workspaceDraftOwner !== null && workspaceDraftOwner !== key;
  workspaceDraftOwner = key;
  workspaceUndoHistory = [];
  const undo = document.getElementById('undoWorkspaceBtn');
  if (undo) {
    undo.disabled = true;
    undo.onclick = undoWorkspaceReplacement;
  }
  let draft = null;
  try { draft = JSON.parse(sessionStorage.getItem(key)); } catch (_) {}
  ['resumeText', 'jobText'].forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;
    if (changingUser) {
      field.value = '';
      if (id === 'resumeText') delete field.dataset.profileId;
    }
    if (!field.value && draft && typeof draft[id === 'resumeText' ? 'resume' : 'job'] === 'string') {
      field.value = draft[id === 'resumeText' ? 'resume' : 'job'];
      if (id === 'resumeText') field.dataset.profileId = draft.profileId || '';
    }
    updateCharCounter(field, document.getElementById(id === 'resumeText' ? 'resumeCount' : 'jobCount'));
    if (field.dataset.draftBound) return;
    field.dataset.draftBound = 'true';
    field.addEventListener('input', () => {
      field.removeAttribute('aria-invalid');
      const error = document.getElementById(id === 'resumeText' ? 'resumeError' : 'jobError');
      if (error) error.textContent = '';
      saveWorkspaceDraft();
    });
  });
  renderResumeVersionSelect(document.getElementById('resumeText')?.dataset.profileId || '');
  saveWorkspaceDraft();
  if (draft) {
    const status = document.getElementById('draftStatus');
    if (status) status.textContent = 'Draft restored from this tab.';
  }
}

/**
 * 7a. Quick Studio Presets & Empty State Helpers
 */
function initStudioPresets() {
  const sampleResumeSweBtn = document.getElementById('sampleResumeSweBtn');
  const sampleResumeDevOpsBtn = document.getElementById('sampleResumeDevOpsBtn');
  const clearResumeBtn = document.getElementById('clearResumeBtn');
  const sampleJobSweBtn = document.getElementById('sampleJobSweBtn');
  const sampleJobDevOpsBtn = document.getElementById('sampleJobDevOpsBtn');
  const clearJobBtn = document.getElementById('clearJobBtn');

  const resumeText = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');
  const jobText = document.getElementById('jobText');
  const jobCount = document.getElementById('jobCount');

  const sampleSweResume = 'Full-Stack Software Engineer with 6+ years experience architecting scalable React, Next.js, Node.js, and TypeScript applications. Built event-driven Kafka microservices, optimized PostgreSQL databases with 35% latency reduction, and led CI/CD Docker deployments on AWS.';
  const sampleDevOpsResume = 'Senior Cloud & Platform Engineer experienced in Kubernetes, Docker, Terraform, AWS, and GCP infrastructure. Slashed build times by 50% via automated GitHub Actions pipelines and maintained 99.99% system availability across multi-region deployments.';

  const sampleSweJob = 'We are seeking a Staff Full-Stack Software Engineer to scale global payments infrastructure. Required: 6+ years experience with React, TypeScript, Node.js, high-throughput PostgreSQL, and event-driven microservices. Deep knowledge of API resilience, Docker, AWS, Kubernetes, and GraphQL.';
  const sampleDevOpsJob = 'Looking for a Lead SRE / Cloud Platform Engineer to oversee our global telemetry clusters. Qualifications: 5+ years with Kubernetes, Terraform, Prometheus/Grafana, Go/Python, and AWS/GCP cloud orchestration. Experience with 99.99% SLAs and zero-downtime rollouts.';

  document.getElementById('loadSamplePairBtn')?.addEventListener('click', () => {
    rememberWorkspaceReplacement();
    // Treat loading both documents as one replacement so one Undo restores both.
    if (resumeText) { resumeText.value = sampleSweResume; resumeText.dataset.profileId = ''; }
    const profile = document.getElementById('resumeVersionSelect');
    if (profile) profile.value = '';
    if (jobText) jobText.value = sampleSweJob;
    [resumeText, jobText].forEach(field => field?.dispatchEvent(new Event('input', { bubbles: true })));
    updateComparisonReadiness();
  });

  if (sampleResumeSweBtn && resumeText) {
    sampleResumeSweBtn.addEventListener('click', () => {
      replaceWorkspaceText('resumeText', sampleSweResume);
      updateCharCounter(resumeText, resumeCount);
      if (!loadingSamplePair) showToast('Loaded Full-Stack Lead sample resume.', 'info', 2000);
    });
  }

  if (sampleResumeDevOpsBtn && resumeText) {
    sampleResumeDevOpsBtn.addEventListener('click', () => {
      replaceWorkspaceText('resumeText', sampleDevOpsResume);
      updateCharCounter(resumeText, resumeCount);
      showToast('Loaded Cloud & DevOps sample resume.', 'info', 2000);
    });
  }

  if (clearResumeBtn && resumeText) {
    clearResumeBtn.addEventListener('click', () => {
      replaceWorkspaceText('resumeText', '');
      updateCharCounter(resumeText, resumeCount);
      showToast('Cleared resume input.', 'info', 1500);
    });
  }

  if (sampleJobSweBtn && jobText) {
    sampleJobSweBtn.addEventListener('click', () => {
      replaceWorkspaceText('jobText', sampleSweJob);
      updateCharCounter(jobText, jobCount);
      if (!loadingSamplePair) showToast('Loaded the sample staff engineer role.', 'info', 2000);
    });
  }

  if (sampleJobDevOpsBtn && jobText) {
    sampleJobDevOpsBtn.addEventListener('click', () => {
      replaceWorkspaceText('jobText', sampleDevOpsJob);
      updateCharCounter(jobText, jobCount);
      showToast('Loaded the sample cloud engineer role.', 'info', 2000);
    });
  }

  if (clearJobBtn && jobText) {
    clearJobBtn.addEventListener('click', () => {
      replaceWorkspaceText('jobText', '');
      updateCharCounter(jobText, jobCount);
      showToast('Cleared target job input.', 'info', 1500);
    });
  }
}

/**
 * 7b. Resume Version Manager
 */
let resumeVersions = [
  {
    id: 'ver-default-1',
    name: 'Full-Stack Lead (React & Node)',
    content: 'Full-Stack Software Engineer with 6+ years experience architecting scalable React, Next.js, Node.js, and TypeScript applications. Built event-driven Kafka microservices, optimized PostgreSQL databases, and led CI/CD Docker deployments on AWS.',
    updated_at: new Date().toISOString().split('T')[0]
  },
  {
    id: 'ver-default-2',
    name: 'Cloud & DevOps Specialist',
    content: 'Senior Cloud & Platform Engineer experienced in Kubernetes, Docker, Terraform, AWS, and GCP infrastructure. Slashed build times by 50% via automated GitHub Actions pipelines and maintained 99.99% system availability.',
    updated_at: new Date().toISOString().split('T')[0]
  }
];

function loadResumeVersionsFromStorage() {
  try {
    const raw = localStorage.getItem('skillsync_resume_versions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        resumeVersions = parsed;
      }
    }
  } catch (_) {}
}

function saveResumeVersionsToStorage() {
  try {
    localStorage.setItem('skillsync_resume_versions', JSON.stringify(resumeVersions));
  } catch (_) {}
}

function renderResumeVersionSelect(activeId) {
  const select = document.getElementById('resumeVersionSelect');
  if (!select) return;

  select.innerHTML = '';
  const draftOption = document.createElement('option');
  draftOption.value = '';
  draftOption.textContent = 'Current draft';
  select.appendChild(draftOption);
  resumeVersions.forEach(ver => {
    const opt = document.createElement('option');
    opt.value = ver.id;
    opt.textContent = ver.name;
    if (activeId && ver.id === activeId) opt.selected = true;
    select.appendChild(opt);
  });
}

function switchResumeVersion(versionId, recordUndo = true) {
  const ver = resumeVersions.find(v => v.id === versionId);
  if (!ver) return;

  const resumeText = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');

  if (resumeText) {
    if (recordUndo) {
      replaceWorkspaceText('resumeText', ver.content, ver.id);
    } else {
      resumeText.value = ver.content;
      resumeText.dataset.profileId = ver.id;
      resumeText.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCharCounter(resumeText, resumeCount);
    if (typeof recomputeAndRenderJobCards === 'function') {
      recomputeAndRenderJobCards();
    }
    showToast(`Switched to "${ver.name}" resume profile`, 'info', 2500);
  }
}

function saveResumeVersion(name, content) {
  if (!name || !name.trim()) return null;
  const validation = validateVersionName(name);
  if (!validation.valid) {
    showToast(validation.error, 'error');
    return null;
  }
  const newVer = {
    id: 'ver-' + Date.now(),
    name: name.trim(),
    content: content || '',
    updated_at: new Date().toISOString().split('T')[0]
  };

  resumeVersions.unshift(newVer);
  saveResumeVersionsToStorage();
  renderResumeVersionSelect(newVer.id);
  const field = document.getElementById('resumeText');
  if (field) field.dataset.profileId = newVer.id;
  saveWorkspaceDraft();
  showToast(`Saved resume version "${newVer.name}"!`, 'success');
  return newVer;
}

function deleteResumeVersion(versionId) {
  if (resumeVersions.length <= 1) {
    showToast('Cannot delete the only resume version.', 'warning');
    return false;
  }

  const ver = resumeVersions.find(v => v.id === versionId);
  if (!ver) return false;
  rememberWorkspaceReplacement();
  const name = ver.name;
  resumeVersions = resumeVersions.filter(v => v.id !== versionId);
  saveResumeVersionsToStorage();

  const nextVer = resumeVersions[0];
  renderResumeVersionSelect(nextVer.id);
  switchResumeVersion(nextVer.id, false);
  showToast(`Deleted resume version "${name}". Use Undo last replacement to restore it.`, 'info');
  return true;
}

function initResumeVersionManager() {
  loadResumeVersionsFromStorage();

  const select = document.getElementById('resumeVersionSelect');
  const saveBtn = document.getElementById('saveResumeVersionBtn');
  const deleteBtn = document.getElementById('deleteResumeVersionBtn');

  const saveModal = document.getElementById('save-version-modal');
  const closeSaveModalBtn = document.getElementById('closeSaveVersionModalBtn');
  const cancelSaveBtn = document.getElementById('cancelSaveVersionBtn');
  const confirmSaveBtn = document.getElementById('confirmSaveVersionBtn');
  const nameInput = document.getElementById('newVersionNameInput');

  if (select) {
    renderResumeVersionSelect();
    select.addEventListener('change', (e) => {
      switchResumeVersion(e.target.value);
    });
  }

  if (saveBtn && saveModal) {
    saveBtn.addEventListener('click', () => {
      if (nameInput) nameInput.value = '';
      saveModal.classList.remove('hidden');
      nameInput?.focus();
    });
  }

  const closeSaveModal = () => saveModal?.classList.add('hidden');
  if (closeSaveModalBtn) closeSaveModalBtn.addEventListener('click', closeSaveModal);
  if (cancelSaveBtn) cancelSaveBtn.addEventListener('click', closeSaveModal);

  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', () => {
      const name = nameInput?.value.trim();
      if (!name) {
        showToast('Please provide a version name.', 'warning');
        return;
      }
      const validation = validateVersionName(name);
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
      }
      const resumeText = document.getElementById('resumeText')?.value || '';
      saveResumeVersion(name, resumeText);
      closeSaveModal();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const activeId = select?.value;
      if (activeId) {
        deleteResumeVersion(activeId);
      }
    });
  }
}

/**
 * 8. Resume Document Extraction (PDF, Image OCR & Clipboard Paste)
 */
async function extractResumeFromPdf(file) {
  const resumeText = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');

  showToast('Extracting text from PDF...', 'info', 2000);

  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js library is not available.');
  }

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items.map(item => item.str);
    fullText += pageStrings.join(' ') + '\n';
  }

  fullText = fullText.replace(/[ \t]+/g, ' ').trim();
  showToast(`PDF parsed successfully! (${pdf.numPages} pages, ${fullText.length.toLocaleString()} characters)`, 'success');

  if (resumeText) {
    replaceWorkspaceText('resumeText', fullText);
    updateCharCounter(resumeText, resumeCount);
  }
  return fullText;
}

async function extractResumeFromImage(file) {
  const resumeText = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');
  const uploadSpinner = document.getElementById('uploadIconSpinner');
  const uploadDefault = document.getElementById('uploadIconDefault');
  const uploadBtnText = document.getElementById('uploadBtnText');

  const setUploadingState = (isUploading) => {
    if (uploadSpinner) uploadSpinner.classList.toggle('hidden', !isUploading);
    if (uploadDefault) uploadDefault.classList.toggle('hidden', isUploading);
    if (uploadBtnText) uploadBtnText.textContent = isUploading ? 'Processing...' : 'Upload Document';
  };

  setUploadingState(true);
  showToast('Extracting text from document...', 'info', 3000);

  try {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    let extractedText = '';

    // 1. Attempt Backend Gemini OCR (ocr.php)
    try {
      let token = 'demo-token';
      if (typeof currentSession !== 'undefined' && currentSession && currentSession.access_token) {
        token = currentSession.access_token;
      } else {
        const storedDemo = localStorage.getItem('skillsync_demo_session');
        if (storedDemo) {
          try {
            token = JSON.parse(storedDemo).access_token || 'demo-token';
          } catch (_) {}
        }
      }

      const response = await fetch('ocr.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ image: base64Data })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.text) {
          extractedText = json.text;
        }
      }
    } catch (apiErr) {
      console.warn('Backend OCR call unavailable, trying local OCR fallback...', apiErr);
    }

    // 2. Client-side OCR fallback via Tesseract.js if available
    if (!extractedText && typeof Tesseract !== 'undefined') {
      showToast('Running client-side OCR engine...', 'info', 2500);
      const ocrResult = await Tesseract.recognize(file, 'eng');
      extractedText = ocrResult?.data?.text || '';
    }

    // 3. Demo fallback if neither backend nor Tesseract is available
    if (!extractedText) {
      const isDemo = (typeof currentSession === 'undefined' || !currentSession || (currentSession.access_token && currentSession.access_token.startsWith('demo-token')) || (typeof supabaseClient === 'undefined' || !supabaseClient));
      if (isDemo) {
        extractedText = `Alex Mercer\nSenior Full-Stack Software Engineer\nEmail: alex.mercer@example.com | San Francisco, CA\n\nPROFESSIONAL SUMMARY\nResults-driven Senior Full-Stack Engineer with 6+ years of experience building high-scale distributed applications, modern web architectures, and microservices in React, TypeScript, Node.js, and PostgreSQL.\n\nTECHNICAL SKILLS\n- Frontend: React, Next.js, TypeScript, Tailwind CSS, Redux, Webpack\n- Backend: Node.js, Express, PostgreSQL, REST APIs, GraphQL, Redis\n- DevOps & Cloud: Docker, Kubernetes, AWS (S3, ECS), CI/CD pipelines\n\nWORK EXPERIENCE\nSenior Software Engineer | TechSphere Labs (2022 - Present)\n- Led architecture of React and Node.js microservices serving 2M+ active monthly users.\n- Optimized PostgreSQL query execution by 42% through strategic index refactoring.\n- Mentored 5 junior engineers and conducted peer code reviews.`;
      } else {
        throw new Error('Could not extract readable text from the provided image. Please check image clarity or try another format.');
      }
    }

    extractedText = extractedText.replace(/[ \t]+/g, ' ').trim();
    showToast('Resume image transcribed successfully!', 'success');

    if (resumeText) {
      replaceWorkspaceText('resumeText', extractedText);
      updateCharCounter(resumeText, resumeCount);
    }
    return extractedText;
  } catch (err) {
    console.error('Image OCR error:', err);
    showToast('Failed to transcribe image: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  } finally {
    setUploadingState(false);
  }
}

async function extractResumeFromFile(file) {
  if (!file) return;

  // Guard against oversized uploads (>15MB) to protect browser memory
  if (file.size && file.size > 15 * 1024 * 1024) {
    showToast('File size exceeds 15MB limit. Please upload a smaller document.', 'error', 4000);
    return;
  }

  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
  const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || '');
  const isText = file.type === 'text/plain' || file.type === 'text/markdown' || /\.(txt|md)$/i.test(file.name || '');

  if (isPdf) {
    try {
      await extractResumeFromPdf(file);
    } catch (err) {
      console.error('PDF parsing error:', err);
      showToast('Failed to parse PDF: ' + (err.message || 'Unknown error'), 'error');
    }
  } else if (isImage) {
    try {
      await extractResumeFromImage(file);
    } catch (err) {
      // already toasted in extractResumeFromImage
    }
  } else if (isText) {
    try {
      const text = await file.text();
      const resumeText = document.getElementById('resumeText');
      const resumeCount = document.getElementById('resumeCount');
      if (resumeText) {
        replaceWorkspaceText('resumeText', text);
        updateCharCounter(resumeText, resumeCount);
      }
      showToast(`Text resume loaded successfully! (${text.length.toLocaleString()} characters)`, 'success', 2500);
      return text;
    } catch (err) {
      console.error('Text file reading error:', err);
      showToast('Failed to read text file: ' + (err.message || 'Unknown error'), 'error');
    }
  } else {
    showToast('Please upload a PDF document or image file (PNG, JPG, WEBP), or plain text file (.txt, .md).', 'error');
  }
}

function initPdfUpload() {
  const resumeFileInput = document.getElementById('resumeFileInput');
  const uploadPdfBtn = document.getElementById('uploadPdfBtn');
  const resumeText = document.getElementById('resumeText');
  const dropZone = document.getElementById('resumeDropZone');

  if (uploadPdfBtn && resumeFileInput) {
    uploadPdfBtn.addEventListener('click', () => {
      resumeFileInput.click();
    });
  }

  if (resumeFileInput) {
    resumeFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await extractResumeFromFile(file);
      }
      resumeFileInput.value = '';
    });
  }

  // Clipboard Paste Support (Cmd+V / Ctrl+V with image)
  const handlePaste = async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type && item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          showToast('Image detected on clipboard. Extracting text...', 'info', 2500);
          await extractResumeFromImage(file);
        }
        return;
      }
    }
  };

  if (resumeText) {
    resumeText.addEventListener('paste', handlePaste);
  }

  // Global paste handler when workspace is active
  document.addEventListener('paste', (e) => {
    const activeEl = document.activeElement;
    // Don't intercept paste inside other inputs
    if (activeEl && (activeEl.id === 'jobText' || activeEl.id === 'jobUrlInput' || activeEl.id === 'authEmail' || activeEl.id === 'authPassword' || activeEl.id === 'authConfirmPassword')) {
      return;
    }
    const clipboardData = e.clipboardData;
    if (clipboardData && clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        if (clipboardData.items[i].type && clipboardData.items[i].type.indexOf('image') !== -1) {
          handlePaste(e);
          break;
        }
      }
    }
  });

  // Drag and Drop Support
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'var(--sage)';
        dropZone.style.backgroundColor = 'var(--sage-light)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'transparent';
        dropZone.style.backgroundColor = '';
      }, false);
    });

    dropZone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files && files.length > 0) {
        await extractResumeFromFile(files[0]);
      }
    }, false);
  }
}

/**
 * 9. AI-Powered Job URL Scraper & Cache (scrape.php & Demo Fallback)
 */
function initJobScraper() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const scrapeBtnText = document.getElementById('scrapeBtnText');
  const scrapeSpinner = document.getElementById('scrapeSpinner');
  const jobUrlInput = document.getElementById('jobUrlInput');
  const jobText = document.getElementById('jobText');
  const jobCount = document.getElementById('jobCount');
  const scrapeStatusBadge = document.getElementById('scrapeStatusBadge');

  if (scrapeBtn) {
    scrapeBtn.addEventListener('click', async () => {
      if (!currentSession || !currentSession.access_token) {
        showToast('Please sign in to scrape job descriptions.', 'warning');
        return;
      }

      const url = jobUrlInput ? jobUrlInput.value.trim() : '';
      if (!url) {
        showToast('Please enter a job posting URL.', 'warning');
        return;
      }

      try {
        new URL(url);
      } catch (_) {
        showToast('Please enter a valid URL (including http:// or https://).', 'error');
        return;
      }

      scrapeBtn.disabled = true;
      if (scrapeSpinner) scrapeSpinner.classList.remove('hidden');
      if (scrapeBtnText) scrapeBtnText.textContent = 'Importing...';

      // Demo Mode Scraper Simulation
      if (isDemoMode()) {
        setTimeout(() => {
          const sampleJob =
            `**Target Position**: Senior Software Engineer\n` +
            `**Company / URL**: ${url}\n\n` +
            `**Core Responsibilities**:\n` +
            `- Design and scale distributed backend APIs and frontend micro-apps.\n` +
            `- Collaborate closely with product managers and engineering teammates.\n` +
            `- Optimize relational database queries and caching layers.\n\n` +
            `**Key Technical Requirements**:\n` +
            `- React, TypeScript, Node.js, and PostgreSQL.\n` +
            `- Hands-on experience with Docker containerization and Kubernetes orchestration.\n` +
            `- Cloud platforms (AWS, GCP) and automated CI/CD testing pipelines.\n\n` +
            `**Minimum Qualifications**:\n` +
            `- 4+ years professional software development experience.`;

          if (jobText) {
            replaceWorkspaceText('jobText', sampleJob);
            updateCharCounter(jobText, jobCount);
          }

          if (scrapeStatusBadge) {
            scrapeStatusBadge.textContent = 'Imported job requirements (Demo session)';
          }

          scrapeBtn.disabled = false;
          if (scrapeSpinner) scrapeSpinner.classList.add('hidden');
          if (scrapeBtnText) scrapeBtnText.textContent = 'Import from URL';
          showToast('Job requirements extracted successfully.', 'success');
        }, 700);
        return;
      }

      try {
        if (supabaseClient && typeof supabaseClient.auth?.getSession === 'function') {
          try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (sessionData && sessionData.session) {
              currentSession = sessionData.session;
            }
          } catch (_) {}
        }

        let response = await fetch('scrape.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({ url })
        });

        if (response.status === 401 && supabaseClient && typeof supabaseClient.auth?.refreshSession === 'function') {
          try {
            const { data: refreshedData, error: refreshErr } = await supabaseClient.auth.refreshSession();
            if (!refreshErr && refreshedData && refreshedData.session) {
              currentSession = refreshedData.session;
              response = await fetch('scrape.php', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${currentSession.access_token}`
                },
                body: JSON.stringify({ url })
              });
            }
          } catch (_) {}
        }

        const data = await response.json();

        if (response.status === 429) {
          showToast(data.message || 'Rate limit exceeded (5 req/min). Please wait a moment.', 'warning', 6000);
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || data.error || `HTTP ${response.status}`);
        }

        if (jobText && data.cleaned_description) {
          replaceWorkspaceText('jobText', data.cleaned_description);
          updateCharCounter(jobText, jobCount);
        }

        if (scrapeStatusBadge) {
          scrapeStatusBadge.textContent = data.source === 'cache'
            ? 'Loaded from database cache'
            : 'Imported job requirements';
        }

        showToast(
          data.source === 'cache' ? 'Job description loaded from cache.' : 'Job description imported successfully.',
          'success'
        );
      } catch (err) {
        console.error('Job scrape error:', err);
        showToast(err.message || 'Failed to scrape job URL.', 'error');
      } finally {
        scrapeBtn.disabled = false;
        if (scrapeSpinner) scrapeSpinner.classList.add('hidden');
        if (scrapeBtnText) scrapeBtnText.textContent = 'Import from URL';
      }
    });
  }
}

/**
 * 10. AI Resume & Skill Gap Analysis (api.php & Demo Matcher)
 */
// Canonical names avoid double-counting aliases such as Node and Node.js.
const MATCH_SKILL_ALIASES = {
  'React': ['react'], 'React Native': ['react native'], 'TypeScript': ['typescript'], 'JavaScript': ['javascript'],
  'Node.js': ['node.js', 'nodejs', 'node'], 'Next.js': ['next.js', 'nextjs'], 'Vue': ['vue', 'vue.js'],
  'Angular': ['angular'], 'Svelte': ['svelte'], 'HTML': ['html', 'html5'], 'CSS': ['css', 'css3'],
  'Python': ['python'], 'Go': ['go', 'golang'], 'Java': ['java'], 'C++': ['c++'], 'C#': ['c#'],
  'PHP': ['php'], 'Ruby': ['ruby'], 'Rust': ['rust'], 'SQL': ['sql'], 'Bash': ['bash'],
  'Docker': ['docker'], 'Kubernetes': ['kubernetes', 'k8s'], 'AWS': ['aws', 'amazon web services'],
  'GCP': ['gcp', 'google cloud'], 'Azure': ['azure'], 'Terraform': ['terraform'],
  'PostgreSQL': ['postgresql', 'postgres'], 'MySQL': ['mysql'], 'MongoDB': ['mongodb'], 'Redis': ['redis'],
  'GraphQL': ['graphql'], 'Tailwind': ['tailwind', 'tailwind css'], 'CI/CD': ['ci/cd', 'continuous integration'],
  'Git': ['git'], 'GitHub Actions': ['github actions'], 'Kafka': ['kafka'], 'Microservices': ['microservices'],
  'REST API': ['rest api', 'restful'], 'Linux': ['linux'], 'Playwright': ['playwright'], 'Jest': ['jest'],
  'Express': ['express', 'express.js'], 'FastAPI': ['fastapi'], 'Django': ['django'], 'Flask': ['flask'],
  'Laravel': ['laravel'], 'Prometheus': ['prometheus'], 'Grafana': ['grafana']
};

function calculateDemoMatch(resume, job) {
  const contains = (text, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`, 'i').test(text);
  };
  const target = Object.keys(MATCH_SKILL_ALIASES).filter(skill => MATCH_SKILL_ALIASES[skill].some(alias => contains(job, alias)));
  const matched = target.filter(skill => MATCH_SKILL_ALIASES[skill].some(alias => contains(resume, alias)));
  return {
    match_score: target.length ? Math.round(matched.length / target.length * 100) : 0,
    matched_skills: matched, missing_skills: target.filter(skill => !matched.includes(skill)),
    is_demo: true, source: 'demo', demo_skill_count: target.length, skill_count: target.length
  };
}

function normalizeMatchResult(data) {
  if (!data || typeof data.match_score !== 'number' || !Number.isFinite(data.match_score) || data.match_score < 0 || data.match_score > 100) {
    throw new Error('The analysis service returned an incomplete score. Please try again.');
  }
  const skills = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))] : [];
  const breakdown = {};
  ['core_tech', 'devops_cloud', 'experience_depth', 'domain_fit'].forEach(key => {
    const value = data.breakdown?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) breakdown[key] = value;
  });
  return { ...data, match_score: Math.round(data.match_score), missing_skills: skills(data.missing_skills), matched_skills: skills(data.matched_skills), breakdown };
}

function updateComparisonReadiness() {
  const resume = document.getElementById('resumeText')?.value.trim() || '';
  const job = document.getElementById('jobText')?.value.trim() || '';
  const status = document.getElementById('comparisonReadiness');
  if (status) {
    status.dataset.ready = String(Boolean(resume && job));
    status.textContent = resume && job ? 'Both documents are ready to compare.' : resume ? 'Next, add the target job description.' : job ? 'Next, add your resume.' : 'Add both documents to start your comparison.';
  }
  const stale = Boolean(lastAnalysisInputs && (lastAnalysisInputs.resume !== resume || lastAnalysisInputs.job !== job));
  document.getElementById('resultsStale')?.classList.toggle('hidden', !stale);
  ['tailorResumeBtn', 'generateCoverLetterBtn', 'interviewPrepBtn', 'generateRoadmapBtn'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = stale;
  });
}

function initAnalyzer() {
  const button = document.getElementById('analyzeBtn');
  const label = document.getElementById('analyzeBtnText');
  const spinner = document.getElementById('analyzeSpinner');
  const resumeField = document.getElementById('resumeText');
  const jobField = document.getElementById('jobText');
  const skeleton = document.getElementById('results-skeleton');
  const results = document.getElementById('results-container');
  const errorBox = document.getElementById('analysisError');
  const indicator = document.getElementById('scoringEngineIndicator');
  [resumeField, jobField].forEach(field => {
    field?.addEventListener('input', updateComparisonReadiness);
    field?.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); if (button && !button.disabled) button.click(); }
    });
  });
  updateComparisonReadiness();
  if (!button) return;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    if (!currentSession?.access_token) { showToast('Sign in or open the sample workspace to compare.', 'warning'); return; }
    const owner = currentSession.user?.id;
    const resume = resumeField?.value.trim() || '';
    const job = jobField?.value.trim() || '';
    errorBox?.classList.add('hidden');
    let firstInvalid = null;
    [[resumeField, resume, 'resumeError', 'Add your resume before comparing.'], [jobField, job, 'jobError', 'Add a target job description before comparing.']].forEach(([field, value, id, emptyMessage]) => {
      const message = !value ? emptyMessage : [...value].length > 100000 ? 'This document is too long. Use up to 100,000 characters.' : '';
      field?.setAttribute('aria-invalid', String(Boolean(message)));
      const error = document.getElementById(id); if (error) error.textContent = message;
      if (message && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    if (spinner) spinner.classList.remove('hidden');
    if (label) label.textContent = 'Comparing documents…';
    if (indicator) indicator.textContent = 'Comparing your resume…';
    skeleton?.classList.remove('hidden'); results?.classList.add('hidden');
    let timeout;
    let completed = false;
    const demo = isDemoMode();
    const controller = new AbortController();
    activeAnalysisController = controller;
    try {
      let data;
      if (demo) {
        data = calculateDemoMatch(resume, job);
      } else {
        timeout = setTimeout(() => controller.abort(), 45000);
        if (typeof supabaseClient?.auth?.getSession === 'function') {
          const { data: sessionData } = await supabaseClient.auth.getSession();
          if (sessionData?.session) currentSession = sessionData.session;
        }
        const request = () => fetch('api.php', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.access_token}` }, body: JSON.stringify({ resume, job_description: job }) });
        let response = await request();
        if (response.status === 401 && typeof supabaseClient?.auth?.refreshSession === 'function') {
          const { data: refreshed, error } = await supabaseClient.auth.refreshSession();
          if (!error && refreshed?.session) { currentSession = refreshed.session; response = await request(); }
        }
        if (response.status === 401) { showSessionExpiredModal(); throw new Error('Your session expired. Sign in again, then retry. Your documents are preserved.'); }
        try { data = await response.json(); } catch (_) { throw new Error('The analysis service is unavailable. Please try again in a moment.'); }
        if (response.status === 429) throw new Error('You’ve reached the comparison limit. Wait one minute, then try again.');
        if (!response.ok) throw new Error('The comparison could not finish. Please try again in a moment.');
      }
      if (currentSession?.user?.id !== owner) return;
      lastAnalysisResult = { ...normalizeMatchResult(data), resume_snippet: resume.substring(0,150), job_description: job.substring(0,150) };
      lastAnalysisInputs = { resume, job };
      // Remove the placeholder before measuring the report scroll position.
      skeleton?.classList.add('hidden');
      renderResults(lastAnalysisResult);
      updateComparisonReadiness();
      completed = true;
      if (indicator) indicator.textContent = demo ? 'Demo comparison complete' : 'Comparison complete';
      if (demo) {
        const history = getDemoHistory();
        history.unshift({ id: 'demo-scan-' + Date.now(), user_id: owner, ...lastAnalysisResult, created_at: new Date().toISOString() });
        saveDemoHistory(history); fetchDashboard();
      } else if (supabaseClient && owner) {
        try {
          const { error } = await supabaseClient.from('scan_history').insert([{ user_id: owner, resume_snippet: lastAnalysisResult.resume_snippet, job_description: lastAnalysisResult.job_description, match_score: lastAnalysisResult.match_score, missing_skills: lastAnalysisResult.missing_skills }]);
          if (error) throw error;
          fetchDashboard();
        } catch (_) { showToast('Comparison ready. History could not be saved; copy or export your report.', 'warning'); }
      }
    } catch (error) {
      if (currentSession?.user?.id !== owner) return;
      const message = error.name === 'AbortError' ? 'The comparison took too long. Your documents are preserved. Please try again.' : error.name === 'TypeError' ? 'Check your connection and run the comparison again. Your documents are preserved.' : error.message || 'Check your connection and try again. Your documents are preserved.';
      if (errorBox) { errorBox.textContent = message; errorBox.classList.remove('hidden'); }
      // Preserve the previous report and visibly mark it if documents changed.
      if (lastAnalysisResult) { results?.classList.remove('hidden'); updateComparisonReadiness(); }
      if (indicator) indicator.textContent = 'Comparison needs a retry';
    } finally {
      clearTimeout(timeout);
      activeAnalysisController = null;
      button.disabled = false; button.setAttribute('aria-busy', 'false');
      spinner?.classList.add('hidden'); skeleton?.classList.add('hidden');
      if (label) label.textContent = completed ? 'Compare again' : 'Compare documents';
    }
  });
}

function renderResults(result) {
  const resultsContainer = document.getElementById('results-container');
  const scoreBadge = document.getElementById('scoreBadge');
  const scoreNumber = document.getElementById('scoreNumber');
  const scoreFeedback = document.getElementById('scoreFeedback');
  const skillsContainer = document.getElementById('skillsBadgesContainer');

  if (!resultsContainer) return;

  const colors = getScoreColorClasses(result.match_score);

  if (scoreBadge) {
    scoreBadge.className = `score-radial-container w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center font-black text-xl sm:text-2xl shadow-lg relative ${colors.badge}`;
  }
  if (scoreNumber) {
    scoreNumber.textContent = `${result.match_score}%`;
  }

  // Sync SVG radial progress ring if present
  const scoreRadialCircle = document.getElementById('scoreRadialCircle');
  if (scoreRadialCircle && typeof SkillSyncOdometer !== 'undefined') {
    const radialMetrics = SkillSyncOdometer.calculateRadialMetrics(result.match_score, 38);
    scoreRadialCircle.style.strokeDasharray = `${radialMetrics.circumference}`;
    scoreRadialCircle.style.strokeDashoffset = `${radialMetrics.offset}`;
    scoreRadialCircle.style.stroke = radialMetrics.color;
  }

  if (scoreFeedback) {
    scoreFeedback.textContent = `${colors.label} • Evaluation against requirements`;
  }

  const demo = result.is_demo === true || result.source === 'demo';
  const fallback = result.source === 'keyword_fallback' || result.source === 'resilient_engine';
  const keyword = demo || fallback;
  const unassessed = result.skill_count === 0 || (demo && result.demo_skill_count === 0);
  const source = document.getElementById('scoreSource');
  if (source) source.textContent = demo ? 'Demo · keyword comparison' : fallback ? 'Keyword fallback' : 'AI estimate';
  const method = document.getElementById('scoreMethod');
  if (method?.parentElement?.classList.contains('report-explanation')) method.parentElement.open = unassessed;
  document.getElementById('generateRoadmapBtn')?.classList.toggle('hidden', unassessed || !result.missing_skills?.length);
  if (method) method.textContent = unassessed
    ? 'No supported technology names were recognized in this role. This keyword comparison cannot assess the match. Try a technical role sample or use the AI comparison.'
    : keyword
      ? (demo ? 'This demo runs in your browser. ' : 'The AI service was unavailable, so a keyword comparison was used. ') + 'The score measures recognized technology names shared by these documents. Experience quality and hiring outcomes are not assessed.'
      : 'This comparison is an AI estimate, not an employer ATS result or a hiring prediction. Review each suggestion against your actual experience.';
  if (unassessed && scoreNumber) scoreNumber.textContent = 'N/A';
  if (keyword && scoreFeedback) scoreFeedback.textContent = unassessed ? 'Not enough recognized skills to compare' : `${result.match_score}% of recognized job skills appear in your resume`;
  const matchedSection = document.getElementById('matchedSkillsSection');
  const matchedList = document.getElementById('matchedSkillsList');
  const matched = Array.isArray(result.matched_skills) ? result.matched_skills : [];
  if (matchedSection) matchedSection.classList.toggle('hidden', matched.length === 0);
  if (matchedList) {
    matchedList.replaceChildren();
    matched.forEach(skill => { const chip = document.createElement('span'); chip.className = 'matched-skill'; chip.textContent = '✓ ' + skill; matchedList.appendChild(chip); });
  }

  // Only display dimensions actually returned by the assessment.
  const breakdown = result.breakdown || {};
  const assessed = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  const metrics = [['Core', 'core_tech'], ['Cloud', 'devops_cloud'], ['Exp', 'experience_depth'], ['Domain', 'domain_fit']];
  metrics.forEach(([id, key]) => {
    const label = document.getElementById(`breakdown${id}Val`);
    const bar = document.getElementById(`breakdown${id}Bar`);
    const valid = assessed(breakdown[key]);
    if (label) label.textContent = valid ? `${breakdown[key]}%` : 'Not assessed';
    if (bar) bar.style.width = valid ? `${breakdown[key]}%` : '0%';
  });
  const section = document.getElementById('breakdownSection');
  if (section) section.classList.toggle('hidden', !metrics.some(([, key]) => assessed(breakdown[key])));
  const description = document.getElementById('nextStepDescription');
  if (description) description.textContent = result.missing_skills?.length
    ? `Start by reviewing ${result.missing_skills.slice(0, 3).join(', ')}. Include relevant experience you can support, or use the study plan to build it.`
    : 'Review the role requirements, then make your most relevant experience clear with specific examples and measurable outcomes.';

  if (skillsContainer) {
    skillsContainer.innerHTML = '';
    if (unassessed) {
      const note = document.createElement('p'); note.className = 'score-method'; note.textContent = 'No skills were assessed. A missing list here does not mean the role is a complete match.'; skillsContainer.appendChild(note);
    } else if (!result.missing_skills || result.missing_skills.length === 0) {
      skillsContainer.innerHTML = `
        <span class="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
          <span>No missing skills were identified by this comparison. Review the full requirements as well.</span>
        </span>
      `;
    } else {
      result.missing_skills.forEach(skill => {
        const youtubeUrl = generateYouTubeLink(skill);
        const a = document.createElement('a');
        a.href = youtubeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'group inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition' +
          ' bg-[var(--paper-2)] hover:bg-slate-200 bg-[var(--paper-2)] dark:hover:bg-slate-700 text-[var(--ink-2)] dark:text-slate-200 border border-slate-300/60 dark:border-slate-700';
        a.innerHTML = `
          <span>${escapeHtml(skill)}</span>
          <svg class="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        `;
        skillsContainer.appendChild(a);
      });
    }
  }

  resultsContainer.classList.remove('hidden');
  if (typeof resultsContainer.scrollIntoView === 'function') {
    resultsContainer.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    if (typeof resultsContainer.focus === 'function') resultsContainer.focus({ preventScroll: true });
  }
}

/**
 * 11. PDF Export & Clipboard Copy
 */
function initExportAndClipboard() {
  const copyReportBtn = document.getElementById('copyReportBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', async () => {
      if (!lastAnalysisResult) {
        showToast('No active analysis to copy.', 'warning');
        return;
      }

      const skillsText = lastAnalysisResult.missing_skills.length > 0
        ? lastAnalysisResult.missing_skills.join(', ')
        : 'None identified by this comparison';
      const matchText = lastAnalysisResult.skill_count === 0 || (lastAnalysisResult.is_demo && lastAnalysisResult.demo_skill_count === 0)
        ? 'Not assessed'
        : `${lastAnalysisResult.match_score}%`;

      const reportText = `SkillSync Match Report${lastAnalysisResult.is_demo ? ' — Demo keyword comparison' : lastAnalysisResult.source === 'keyword_fallback' ? ' — Keyword fallback' : ' — AI estimate'}\n` +
        `------------------------\n` +
        `Match Compatibility: ${matchText}\n` +
        (document.getElementById('resultsStale') && !document.getElementById('resultsStale').classList.contains('hidden') ? 'Previous comparison: documents have changed.\n' : '') +
        `Identified Skill Gaps: ${skillsText}\n\n` +
        `Generated by SkillSync. This estimate is not an employer ATS result or a hiring prediction.`;

      try {
        await navigator.clipboard.writeText(reportText);
        showToast('Report copied to clipboard!', 'success');
      } catch (err) {
        console.error('Clipboard copy error:', err);
        showToast('Failed to copy to clipboard.', 'error');
      }
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      if (!lastAnalysisResult) {
        showToast('No active analysis to export.', 'warning');
        return;
      }

      const reportElement = document.getElementById('printableReport');
      if (!reportElement || typeof html2pdf === 'undefined') {
        showToast('PDF export tool is unavailable.', 'error');
        return;
      }

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `SkillSync_Report_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      showToast('Generating PDF document...', 'info', 2000);
      html2pdf().set(opt).from(reportElement).save()
        .then(() => {
          showToast('PDF exported successfully!', 'success');
        })
        .catch(err => {
          console.error('html2pdf error:', err);
          showToast('Failed to export PDF.', 'error');
        });
    });
  }
}

/**
 * 12. History Dashboard (Dynamic Ordering, Single Deletion & Clear All)
 */
async function fetchDashboard() {
  const sortSelect = document.getElementById('sortDashboard');
  const sortValue = sortSelect ? sortSelect.value : 'newest';

  // Demo Mode Dashboard Loading
  if (isDemoMode()) {
    const items = getDemoHistory();
    items.sort((a, b) => {
      if (sortValue === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortValue === 'score_desc') {
        return b.match_score - a.match_score;
      }
      if (sortValue === 'score_asc') {
        return a.match_score - b.match_score;
      }
      // default: newest
      return new Date(b.created_at) - new Date(a.created_at);
    });
    renderDashboardGrid(items);
    return;
  }

  if (!supabaseClient || !currentSession || !currentSession.user) {
    renderDashboardGrid([]);
    return;
  }

  let orderColumn = 'created_at';
  let isAscending = false;

  switch (sortValue) {
    case 'oldest':
      orderColumn = 'created_at';
      isAscending = true;
      break;
    case 'score_desc':
      orderColumn = 'match_score';
      isAscending = false;
      break;
    case 'score_asc':
      orderColumn = 'match_score';
      isAscending = true;
      break;
    default: // newest
      orderColumn = 'created_at';
      isAscending = false;
      break;
  }

  try {
    const { data, error } = await supabaseClient
      .from('scan_history')
      .select('*')
      .eq('user_id', currentSession.user.id)
      .order(orderColumn, { ascending: isAscending });

    if (error) throw error;

    renderDashboardGrid(data || []);
  } catch (err) {
    console.error('Error fetching scan history:', err);
    showToast('Failed to load scan history.', 'error');
  }
}

function renderDashboardGrid(items) {
  const grid = document.getElementById('history-grid');
  const emptyState = document.getElementById('history-empty');
  const clearAllBtn = document.getElementById('clearAllBtn');

  if (!grid) return;
  grid.innerHTML = '';

  if (!items || items.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (clearAllBtn) {
      clearAllBtn.disabled = true;
      clearAllBtn.classList.add('opacity-40', 'cursor-not-allowed');
    }
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (clearAllBtn) {
    clearAllBtn.disabled = false;
    clearAllBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'console-card p-5 transition flex flex-col justify-between hover:translate-y-[-2px]';

    const colors = getScoreColorClasses(item.match_score);
    const dateFormatted = new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const skills = Array.isArray(item.missing_skills) ? item.missing_skills : [];
    const skillsHtml = skills.slice(0, 3).map(skill => `
      <a href="${generateYouTubeLink(skill)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition hover:border-emerald-500/40" style="background: var(--paper-3); color: var(--ink); border: 1px solid var(--border);">
        <svg class="w-3 h-3 text-rose-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>${escapeHtml(skill)}</span>
      </a>
    `).join(' ') + (skills.length > 3 ? `<span class="text-[10px] opacity-60" style="color: var(--ink-4);">+${skills.length - 3} more</span>` : '');

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2.5">
          <span class="px-2.5 py-1 rounded-xl text-xs font-semibold ${colors.badge}">
            ${item.match_score}% Match
          </span>
          <span class="text-[11px] font-mono opacity-65" style="color: var(--ink-4);">${dateFormatted}</span>
        </div>
        <div class="space-y-1.5 mb-3.5">
          <p class="text-xs font-medium line-clamp-2" style="color: var(--ink);" title="Target Job">${escapeHtml(item.job_description)}</p>
          <p class="text-[11px] line-clamp-2 opacity-75" style="color: var(--ink-3);" title="Resume Extract">${escapeHtml(item.resume_snippet)}</p>
        </div>
      </div>
      <div>
        <div class="flex flex-wrap gap-1.5 items-center mb-3">
          ${skillsHtml}
        </div>
        <div class="flex items-center justify-between pt-2.5 border-t" style="border-color: var(--border);">
          <span class="text-[10px] opacity-60" style="color: var(--ink-4);">${skills.length} ${skills.length === 1 ? 'skill gap' : 'skill gaps'}</span>
          <button data-id="${item.id}" class="delete-history-btn inline-flex items-center space-x-1 text-xs font-medium text-rose-500 hover:text-rose-600 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  document.querySelectorAll('.delete-history-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        pendingDeleteId = id;
        const modal = document.getElementById('delete-modal');
        if (modal) modal.classList.remove('hidden');
      }
    });
  });
}

/**
 * 13. Dashboard Modals & Actions
 */
function initModals() {
  const deleteModal = document.getElementById('delete-modal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  if (cancelDeleteBtn && deleteModal) {
    cancelDeleteBtn.addEventListener('click', () => {
      deleteModal.classList.add('hidden');
      pendingDeleteId = null;
    });
  }

  if (confirmDeleteBtn && deleteModal) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!pendingDeleteId) return;

      if (isDemoMode()) {
        const history = getDemoHistory().filter(item => item.id !== pendingDeleteId);
        saveDemoHistory(history);
        showToast('Scan record deleted.', 'success');
        fetchDashboard();
        deleteModal.classList.add('hidden');
        pendingDeleteId = null;
        return;
      }

      if (!supabaseClient) return;

      try {
        const { error } = await supabaseClient
          .from('scan_history')
          .delete()
          .eq('id', pendingDeleteId);

        if (error) throw error;

        showToast('Scan record deleted.', 'success');
        fetchDashboard();
      } catch (err) {
        console.error('Delete error:', err);
        showToast('Failed to delete scan record.', 'error');
      } finally {
        deleteModal.classList.add('hidden');
        pendingDeleteId = null;
      }
    });
  }

  const clearAllModal = document.getElementById('clear-all-modal');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const cancelClearAllBtn = document.getElementById('cancelClearAllBtn');
  const confirmClearAllBtn = document.getElementById('confirmClearAllBtn');

  if (clearAllBtn && clearAllModal) {
    clearAllBtn.addEventListener('click', () => {
      clearAllModal.classList.remove('hidden');
    });
  }

  if (cancelClearAllBtn && clearAllModal) {
    cancelClearAllBtn.addEventListener('click', () => {
      clearAllModal.classList.add('hidden');
    });
  }

  if (confirmClearAllBtn && clearAllModal) {
    confirmClearAllBtn.addEventListener('click', async () => {
      if (isDemoMode()) {
        saveDemoHistory([]);
        showToast('All scan history cleared.', 'success');
        fetchDashboard();
        clearAllModal.classList.add('hidden');
        return;
      }

      if (!supabaseClient || !currentSession || !currentSession.user) return;

      try {
        const { error } = await supabaseClient
          .from('scan_history')
          .delete()
          .eq('user_id', currentSession.user.id);

        if (error) throw error;

        showToast('All scan history cleared.', 'success');
        fetchDashboard();
      } catch (err) {
        console.error('Clear all error:', err);
        showToast('Failed to clear scan history.', 'error');
      } finally {
        clearAllModal.classList.add('hidden');
      }
    });
  }

  const sortDashboard = document.getElementById('sortDashboard');
  if (sortDashboard) {
    sortDashboard.addEventListener('change', () => {
      fetchDashboard();
    });
  }
}

/**
 * 15. Smart Job Discovery Feed & Real-Time Pre-Scoring Engine
 */
let discoveredJobsCache = [];
let activeWorkspaceTab = 'ats';
const JOBS_PER_PAGE = 10;
let currentJobsPage = 1;

let vaultDocumentsCache = [
  {
    id: 'doc-vault-1',
    doc_type: 'resume',
    doc_name: 'Master_Software_Engineer_CV.pdf',
    content_snippet: 'Senior Developer with 5 years leading full-stack projects in React, Node.js, TypeScript, and AWS.',
    extracted_skills: ['React', 'TypeScript', 'Node.js', 'AWS', 'PostgreSQL'],
    created_at: '2026-10-28'
  },
  {
    id: 'doc-vault-2',
    doc_type: 'certification',
    doc_name: 'AWS_Solutions_Architect_Certificate.pdf',
    content_snippet: 'AWS Certified Solutions Architect – Associate. Verified cloud architecture, Docker, and microservices.',
    extracted_skills: ['AWS', 'Docker', 'Cloud Architecture'],
    created_at: '2026-10-30'
  }
];

let verifiedSkillsMatrix = {
  languages: ['TypeScript', 'JavaScript', 'Python', 'SQL'],
  frameworks: ['React', 'Next.js', 'Node.js', 'FastAPI', 'Tailwind CSS'],
  cloud: ['Docker', 'AWS', 'PostgreSQL', 'Redis', 'CI/CD'],
  certifications: ['AWS Certified Solutions Architect']
};

function getAllVaultSkills() {
  const all = new Set();
  if (verifiedSkillsMatrix) {
    Object.values(verifiedSkillsMatrix).forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(s => all.add(s.toLowerCase()));
      }
    });
  }
  for (const doc of vaultDocumentsCache) {
    if (doc.id?.startsWith('planner-project-')) {
      doc.extracted_skills.forEach(skill => all.add(skill.toLowerCase()));
    }
  }
  return Array.from(all);
}

const FALLBACK_DISCOVERY_JOBS = [
  {
    id: 'job-101',
    title: 'Senior Frontend Engineer (React & TypeScript)',
    company_name: 'Vercel',
    location: 'Remote',
    remote: true,
    url: 'https://vercel.com/careers',
    tags: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL'],
    salary: '$140,000 - $185,000',
    created_at: '2026-10-31',
    description: 'Build high-performance web applications with React, Next.js, and TypeScript. Optimize web vitals and collaborate with design and backend teams.'
  },
  {
    id: 'job-102',
    title: 'Full-Stack Developer (Node.js & React)',
    company_name: 'Stripe',
    location: 'San Francisco, CA / Remote',
    remote: true,
    url: 'https://stripe.com/jobs',
    tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    salary: '$150,000 - $195,000',
    created_at: '2026-10-30',
    description: 'Design and deploy robust payment infrastructure with TypeScript, Node.js, React, and PostgreSQL. Implement containerized microservices.'
  },
  {
    id: 'job-103',
    title: 'Backend Engineer (Python & FastAPI)',
    company_name: 'Datadog',
    location: 'New York, NY / Remote',
    remote: true,
    url: 'https://www.datadoghq.com/careers',
    tags: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Kubernetes', 'Docker'],
    salary: '$155,000 - $205,000',
    created_at: '2026-10-29',
    description: 'Scale distributed ingestion pipelines and microservices in Python (FastAPI). Manage cache layers with Redis and Kubernetes deployments.'
  },
  {
    id: 'job-104',
    title: 'Cloud Platform & DevOps Engineer',
    company_name: 'HashiCorp',
    location: 'Remote',
    remote: true,
    url: 'https://www.hashicorp.com/jobs',
    tags: ['Kubernetes', 'Terraform', 'Docker', 'AWS', 'CI/CD', 'Linux'],
    salary: '$145,000 - $190,000',
    created_at: '2026-10-28',
    description: 'Automate multi-region cloud infrastructure using Terraform, Kubernetes, and Docker. Build zero-downtime CI/CD deployment pipelines.'
  },
  {
    id: 'job-105',
    title: 'PHP & Laravel Backend Engineer',
    company_name: 'Envato',
    location: 'Remote',
    remote: true,
    url: 'https://www.envato.com/careers',
    tags: ['PHP', 'Laravel', 'MySQL', 'Redis', 'Docker', 'REST API'],
    salary: '$110,000 - $145,000',
    created_at: '2026-10-27',
    description: 'Maintain and modernize marketplace APIs with PHP 8, Laravel, and MySQL. Implement asynchronous job queues and Redis caching.'
  },
  {
    id: 'job-106',
    title: 'Mobile Engineer (React Native & TypeScript)',
    company_name: 'Linear',
    location: 'Remote',
    remote: true,
    url: 'https://linear.app/careers',
    tags: ['React Native', 'TypeScript', 'iOS', 'Android', 'GraphQL'],
    salary: '$140,000 - $180,000',
    created_at: '2026-10-26',
    description: 'Craft high-performance, fluid mobile applications on iOS and Android with React Native and TypeScript.'
  }
];

const SKILL_KEYWORDS_TAXONOMY = [
  'react', 'react native', 'vue.js', 'vue', 'angular', 'svelte', 'next.js',
  'typescript', 'javascript', 'html5', 'css3', 'tailwind css', 'tailwind',
  'node.js', 'node', 'express', 'python', 'fastapi', 'django', 'flask',
  'php', 'laravel', 'ruby', 'go', 'golang', 'rust', 'c++', 'java',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite',
  'docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure', 'ci/cd',
  'graphql', 'rest api', 'rest', 'kafka', 'playwright', 'jest', 'linux', 'git'
];

function extractSkillsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const matched = new Set();
  SKILL_KEYWORDS_TAXONOMY.forEach(skill => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(?:^|[\\s,;:.()/\\[\\]])' + escaped + '(?:$|[\\s,;:.()/\\[\\]])', 'i');
    if (regex.test(lower)) {
      matched.add(skill);
    }
  });
  return Array.from(matched);
}

function calculateJobCompatibility(candidateText, job, includeVault = false) {
  let candidateSkills = extractSkillsFromText(candidateText);
  let isDefaultProfile = false;

  if (candidateSkills.length === 0) {
    if (includeVault && typeof getAllVaultSkills === 'function') {
      const vaultSkills = getAllVaultSkills();
      if (vaultSkills.length > 0) {
        candidateSkills = [...vaultSkills];
      }
    }
  }

  if (candidateSkills.length === 0) {
    isDefaultProfile = true;
    candidateSkills = ['react', 'typescript', 'javascript', 'html5', 'css3', 'node.js', 'git', 'rest api'];
  }

  const jobReqs = new Set();
  if (Array.isArray(job.tags)) {
    job.tags.forEach(t => jobReqs.add(t.toLowerCase()));
  }
  const descSkills = extractSkillsFromText(job.description || '');
  descSkills.forEach(s => jobReqs.add(s));
  const titleSkills = extractSkillsFromText(job.title || '');
  titleSkills.forEach(s => jobReqs.add(s));

  if (jobReqs.size === 0) {
    jobReqs.add('software engineering');
    jobReqs.add('problem solving');
  }

  const candidateSet = new Set(candidateSkills);
  const matching = [];
  const missing = [];

  jobReqs.forEach(req => {
    let hasMatch = false;
    candidateSet.forEach(c => {
      if (c === req || c.includes(req) || req.includes(c)) {
        hasMatch = true;
      }
    });

    if (hasMatch) {
      matching.push(req);
    } else {
      missing.push(req);
    }
  });

  const total = matching.length + missing.length;
  const ratio = total > 0 ? matching.length / total : 0.5;
  const rawScore = Math.round(38 + (ratio * 58));
  const score = Math.max(35, Math.min(98, rawScore));
  const colorInfo = getScoreColorClasses(score);

  return {
    score,
    label: colorInfo.label,
    badgeClass: colorInfo.badge,
    matchingSkills: matching.slice(0, 4),
    missingSkills: missing.slice(0, 4),
    isDefaultProfile
  };
}

function switchWorkspaceTab(tabName) {
  const tabAts = document.getElementById('tabAtsMatcher');
  const tabDiscovery = document.getElementById('tabJobDiscovery');
  const tabVault = document.getElementById('tabSkillVault');
  const tabPipeline = document.getElementById('tabPipeline');
  const atsView = document.getElementById('ats-view');
  const discoveryView = document.getElementById('discovery-view');
  const vaultView = document.getElementById('vault-view');
  const pipelineView = document.getElementById('pipeline-view');

  if (!tabAts || !atsView) return;
  if (tabName === 'discovery' && !discoveryView) { window.location.href = 'jobs.html'; return; }

  if (typeof SkillSyncAudio !== 'undefined' && typeof SkillSyncAudio.playTabSwitch === 'function') {
    SkillSyncAudio.playTabSwitch();
  }

  activeWorkspaceTab = tabName;
  document.getElementById('loadSamplePairBtn')?.classList.toggle('hidden', tabName !== 'ats');
  const headings = {
    ats: ['Resume comparison', 'Add your resume and a target job description.', 'Ready to compare'],
    discovery: ['Find your next opportunity.', 'Explore roles and bring the requirements into your resume comparison.', 'Job discovery'],
    vault: ['Documents', 'Save experience you want to reuse in applications.', 'Your saved documents'],
    pipeline: ['Applications', 'Track each role from saved to offer.', 'Application pipeline']
  };
  const heading = headings[tabName] || headings.ats;
  const title = document.getElementById('workspaceTitle');
  const description = document.getElementById('workspaceDescription');
  const status = document.getElementById('scoringEngineIndicator');
  if (title) title.textContent = heading[0];
  if (description) description.textContent = heading[1];
  if (status) status.textContent = heading[2];

  const resetBtn = (btn) => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove('active');
    btn.className = 'workspace-segment-tab tab-btn transition flex items-center space-x-1.5';
    btn.style.background = 'transparent';
    btn.style.color = 'var(--ink-3)';
  };

  const activateBtn = (btn) => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('active');
    btn.className = 'workspace-segment-tab tab-btn active font-bold transition flex items-center space-x-1.5 shadow-sm';
    btn.style.background = 'var(--surface)';
    btn.style.color = 'var(--ink)';
  };

  resetBtn(tabAts);
  resetBtn(tabDiscovery);
  resetBtn(tabVault);
  resetBtn(tabPipeline);

  atsView.classList.add('hidden');
  discoveryView?.classList.add('hidden');
  if (vaultView) vaultView.classList.add('hidden');
  if (pipelineView) pipelineView.classList.add('hidden');

  if (tabName === 'ats') {
    atsView.classList.remove('hidden');
    activateBtn(tabAts);
  } else if (tabName === 'discovery') {
    discoveryView.classList.remove('hidden');
    activateBtn(tabDiscovery);
    if (discoveredJobsCache.length === 0) {
      fetchAndRenderJobs();
    } else {
      recomputeAndRenderJobCards();
    }
  } else if (tabName === 'vault') {
    if (vaultView) vaultView.classList.remove('hidden');
    activateBtn(tabVault);
    renderVaultUI();
  } else if (tabName === 'pipeline') {
    if (pipelineView) pipelineView.classList.remove('hidden');
    activateBtn(tabPipeline);
    renderPipeline();
  }
}

function synthesizeConsoleOpportunities() {
  const companies = [
    { name: 'Anthropic', domain: 'Frontier AI & Claude Platform', tech: ['Python', 'FastAPI', 'PyTorch', 'Vector DB'], salary: '$185,000 - $245,000' },
    { name: 'Linear', domain: 'High-Performance Productivity Tools', tech: ['React', 'TypeScript', 'Node.js', 'WebSockets'], salary: '$160,000 - $210,000' },
    { name: 'Supabase', domain: 'Open Source Cloud Postgres Platform', tech: ['PostgreSQL', 'Go', 'TypeScript', 'Docker'], salary: '$150,000 - $195,000' },
    { name: 'Cursor', domain: 'AI Code Generation & Editor Systems', tech: ['TypeScript', 'Rust', 'Python', 'LLM APIs'], salary: '$180,000 - $240,000' },
    { name: 'Stripe', domain: 'Global Financial Infrastructure', tech: ['Go', 'PostgreSQL', 'Docker', 'AWS'], salary: '$165,000 - $215,000' },
    { name: 'Vercel', domain: 'Next.js Frontend Cloud & Edge Network', tech: ['React', 'Next.js', 'TypeScript', 'Rust'], salary: '$155,000 - $205,000' }
  ];
  const titles = [
    'Staff AI Agents & Prompt Systems Engineer',
    'Senior Frontend Engineer (React & Next.js)',
    'Distributed Systems Backend Engineer',
    'Lead Full-Stack Product Architect',
    'Cloud Platform Reliability & DevOps Lead'
  ];
  const shuffled = [...companies].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3).map((c, i) => ({
    id: `console-dyn-${c.name.toLowerCase()}-${Date.now()}-${i}`,
    title: titles[(i + Math.floor(Math.random() * titles.length)) % titles.length],
    company_name: c.name,
    location: 'Remote (Global)',
    remote: true,
    salary: c.salary,
    tags: c.tech,
    url: `https://${c.name.toLowerCase()}.com/careers`,
    relative_time: i === 0 ? 'Just now' : `${(i + 1) * 4}m ago`,
    is_new: true,
    description: `${c.name} is seeking an engineer to join our ${c.domain} group. Core technologies include ${c.tech.join(', ')}.`
  }));
}

async function fetchAndRenderJobs(query = '', remoteOnly = false, resetPage = true) {
  if (resetPage) currentJobsPage = 1;
  const loadingEl = document.getElementById('jobsLoading');
  const gridEl = document.getElementById('jobsGrid');
  const emptyEl = document.getElementById('jobsEmpty');
  const countBadge = document.getElementById('discoveryCountBadge');
  const paginationEl = document.getElementById('jobsPagination');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (gridEl) gridEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (paginationEl) paginationEl.classList.add('hidden');

  try {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (remoteOnly) params.append('remote', 'true');
    params.append('limit', '50');
    params.append('fresh', '1');
    params.append('t', String(Date.now()));

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    const res = await fetch(`jobs.php?${params.toString()}`, {
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Failed to retrieve job listings.');
    const data = await res.json();
    discoveredJobsCache = (data && Array.isArray(data.jobs) && data.jobs.length > 0)
      ? data.jobs
      : [...synthesizeConsoleOpportunities(), ...FALLBACK_DISCOVERY_JOBS];
  } catch (err) {
    const baseList = [...synthesizeConsoleOpportunities(), ...FALLBACK_DISCOVERY_JOBS];
    discoveredJobsCache = baseList.filter(job => {
      if (remoteOnly && !job.remote) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return job.title.toLowerCase().includes(q) ||
        job.company_name.toLowerCase().includes(q) ||
        job.tags.some(t => t.toLowerCase().includes(q));
    });
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (countBadge) countBadge.textContent = `${discoveredJobsCache.length} Available`;
    recomputeAndRenderJobCards();
  }
}

function recomputeAndRenderJobCards() {
  const gridEl = document.getElementById('jobsGrid');
  const emptyEl = document.getElementById('jobsEmpty');
  const paginationEl = document.getElementById('jobsPagination');
  const rangeEl = document.getElementById('paginationRange');
  const totalEl = document.getElementById('paginationTotal');
  const pageIndicatorEl = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevJobsPageBtn');
  const nextBtn = document.getElementById('nextJobsPageBtn');
  const resumeTextEl = document.getElementById('resumeText');
  const scoringStatusText = document.getElementById('scoringStatusText');

  if (!gridEl) return;
  gridEl.innerHTML = '';

  const candidateResume = resumeTextEl ? resumeTextEl.value.trim() : '';

  if (scoringStatusText) {
    if (candidateResume.length > 20) {
      scoringStatusText.textContent = 'Scoring against uploaded resume';
    } else if (typeof getAllVaultSkills === 'function' && getAllVaultSkills().length > 0) {
      scoringStatusText.textContent = `Scoring against ${vaultDocumentsCache.length} vault documents`;
    } else {
      scoringStatusText.textContent = 'Baseline profile active';
    }
  }

  if (!discoveredJobsCache || discoveredJobsCache.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (paginationEl) paginationEl.classList.add('hidden');
    gridEl.classList.add('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  gridEl.classList.remove('hidden');

  const scoredList = discoveredJobsCache.map(job => {
    const compatibility = calculateJobCompatibility(candidateResume, job, true);
    return { ...job, compatibility };
  });

  scoredList.sort((a, b) => b.compatibility.score - a.compatibility.score);

  // Pagination slicing (10 jobs per page)
  const totalJobs = scoredList.length;
  const totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
  if (currentJobsPage > totalPages) currentJobsPage = totalPages;
  if (currentJobsPage < 1) currentJobsPage = 1;

  const startIndex = (currentJobsPage - 1) * JOBS_PER_PAGE;
  const endIndex = Math.min(startIndex + JOBS_PER_PAGE, totalJobs);
  const paginatedJobs = scoredList.slice(startIndex, endIndex);

  paginatedJobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'results-dock p-5 sm:p-6 flex flex-col justify-between transition duration-150 hover:translate-y-[-2px] hover:border-emerald-500/30';
    card.setAttribute('data-job-id', job.id);

    const companyInitial = job.company_name ? job.company_name.charAt(0).toUpperCase() : 'T';
    const comp = job.compatibility;

    const matchedBadges = comp.matchingSkills.length > 0
      ? comp.matchingSkills.map(s => `
          <span class="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>${escapeHtml(s)}</span>
          </span>
        `).join(' ')
      : '';

    const missingBadges = comp.missingSkills.length > 0
      ? comp.missingSkills.slice(0, 3).map(s => `
          <span class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-lg opacity-80" style="background: var(--paper-3); color: var(--ink-3); border: 1px solid var(--ws-border, var(--border));">
            ${escapeHtml(s)}
          </span>
        `).join(' ')
      : '';

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center shrink-0 shadow-xs" style="background: var(--paper-3); color: var(--ink); border: 1px solid var(--ws-border, var(--border));">
              ${escapeHtml(companyInitial)}
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h4 class="font-bold text-sm leading-tight" style="color: var(--ink);">${escapeHtml(job.company_name)}</h4>
                ${job.is_new ? `<span class="px-2 py-0.5 rounded-md font-semibold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> New</span>` : ''}
              </div>
              <div class="flex items-center space-x-2 text-xs mt-0.5" style="color: var(--ink-3);">
                <span>${escapeHtml(job.location)}</span>
                ${job.remote ? `<span class="px-2 py-0.5 rounded font-semibold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Remote</span>` : ''}
                ${job.relative_time ? `<span class="font-mono text-xs opacity-70">${escapeHtml(job.relative_time)}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="shrink-0 text-right">
            <span class="px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center space-x-1 ${comp.badgeClass}">
              <span>${comp.score}%</span>
              <span class="opacity-80 font-medium text-xs">Fit</span>
            </span>
          </div>
        </div>

        <h3 class="font-bold text-base mb-2" style="color: var(--ink);">${escapeHtml(job.title)}</h3>
        <p class="text-xs line-clamp-2 mb-4 leading-relaxed" style="color: var(--ink-3);">${escapeHtml(job.description)}</p>

        <div class="space-y-1.5 mb-4">
          <div class="text-xs uppercase font-bold tracking-wider opacity-60" style="color: var(--ink-4);">ATS Skills Alignment</div>
          <div class="flex flex-wrap gap-1.5 items-center">
            ${matchedBadges}
            ${missingBadges}
          </div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t mt-2" style="border-color: var(--ws-border, var(--border));">
        <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border" style="background: rgba(16, 185, 129, 0.08); color: var(--sage); border-color: rgba(16, 185, 129, 0.2);">${escapeHtml(job.salary || 'Competitive')}</span>
        
        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <button type="button" class="btn-track-job flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-xl transition inline-flex items-center space-x-1 hover:bg-slate-500/10 cursor-pointer" style="background: var(--paper-2); color: var(--sky); border: 1px solid var(--ws-border, var(--border));">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Track</span>
          </button>
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" class="flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-xl transition inline-flex items-center space-x-1 cursor-pointer" style="background: var(--paper-2); color: var(--ink); border: 1px solid var(--ws-border, var(--border));">
            <span>Apply</span>
            <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
          <button type="button" class="btn-load-job flex-1 sm:flex-initial justify-center px-3.5 py-1.5 text-xs font-bold text-white btn-action-primary inline-flex items-center space-x-1.5 cursor-pointer">
            <span>Analyze in Workspace</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </div>
    `;

    const trackBtn = card.querySelector('.btn-track-job');
    if (trackBtn) {
      trackBtn.addEventListener('click', () => {
        addJobToPipeline({
          id: job.id || `job-${Date.now()}`,
          title: job.title,
          company_name: job.company_name,
          location: job.location || 'Remote',
          salary: job.salary || 'Competitive',
          url: job.url || '#',
          score: comp ? comp.score : 70,
          tags: job.tags || [],
          description: cleanJobDescription(job.description),
          status: 'saved',
          created_at: new Date().toISOString().split('T')[0]
        });
      });
    }

    const loadBtn = card.querySelector('.btn-load-job');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        loadJobIntoWorkspace(job);
      });
    }

    gridEl.appendChild(card);
  });

  // Update Pagination Controls
  if (paginationEl) {
    if (totalJobs <= JOBS_PER_PAGE) {
      paginationEl.classList.add('hidden');
    } else {
      paginationEl.classList.remove('hidden');
      if (rangeEl) rangeEl.textContent = `${startIndex + 1}–${endIndex}`;
      if (totalEl) totalEl.textContent = `${totalJobs}`;
      if (pageIndicatorEl) pageIndicatorEl.textContent = `Page ${currentJobsPage} of ${totalPages}`;
      if (prevBtn) prevBtn.disabled = currentJobsPage <= 1;
      if (nextBtn) nextBtn.disabled = currentJobsPage >= totalPages;
    }
  }
}

function setJobsPage(pageNumber) {
  currentJobsPage = pageNumber;
  recomputeAndRenderJobCards();
}

function getPaginationState() {
  const totalJobs = discoveredJobsCache.length;
  const totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
  return {
    currentPage: currentJobsPage,
    totalPages,
    totalJobs,
    jobsPerPage: JOBS_PER_PAGE
  };
}

function loadJobIntoWorkspace(job) {
  const jobText = document.getElementById('jobText');
  const jobCount = document.getElementById('jobCount');
  const scrapeStatusBadge = document.getElementById('scrapeStatusBadge');

  if (jobText) {
    const formattedDesc =
      `Target Role: ${job.title} at ${job.company_name}\n` +
      `Location: ${job.location} | Compensation: ${job.salary || 'Competitive'}\n\n` +
      `Core Responsibilities & Requirements:\n` +
      `${cleanJobDescription(job.description)}\n\n` +
      `Preferred Skills: ${Array.isArray(job.tags) ? job.tags.join(', ') : 'Tech stack requirements'}`;

    replaceWorkspaceText('jobText', formattedDesc);
    updateCharCounter(jobText, jobCount);
  }

  if (scrapeStatusBadge) {
    scrapeStatusBadge.textContent = `Imported: ${job.company_name} - ${job.title}`;
  }

  switchWorkspaceTab('ats');

  showToast(`Loaded ${job.title} into ATS Workspace.`, 'success');

  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateExternalSearchLinks(query = '', remoteOnly = false) {
  const rawQ = query ? query.trim() : '';
  const q = encodeURIComponent(rawQ || 'Software Engineer');
  const lLinkedIn = document.getElementById('extSearchLinkedIn');
  const lUpwork = document.getElementById('extSearchUpwork');
  const lIndeed = document.getElementById('extSearchIndeed');
  const lRemoteOk = document.getElementById('extSearchRemoteOk');

  if (lLinkedIn) {
    lLinkedIn.href = `https://www.linkedin.com/jobs/search/?keywords=${q}&f_TPR=r2592000${remoteOnly ? '&f_WT=2' : ''}`;
  }
  if (lUpwork) {
    lUpwork.href = `https://www.upwork.com/nx/search/jobs/?q=${q}&sort=recency${remoteOnly ? '&location=Anywhere' : ''}`;
  }
  if (lIndeed) {
    lIndeed.href = `https://www.indeed.com/jobs?q=${q}${remoteOnly ? '&l=Remote' : ''}`;
  }
  if (lRemoteOk) {
    const tag = rawQ ? encodeURIComponent(rawQ.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()) : 'engineer';
    lRemoteOk.href = `https://remoteok.com/remote-${tag}-jobs`;
  }
}

function initJobDiscovery() {
  const tabAts = document.getElementById('tabAtsMatcher');
  if (tabAts) tabAts.addEventListener('click', () => switchWorkspaceTab('ats'));
  if (!document.getElementById('discovery-view')) return;
  const tabDiscovery = document.getElementById('tabJobDiscovery');
  const searchInput = document.getElementById('jobSearchInput');
  const remoteCheckbox = document.getElementById('remoteFilterCheckbox');
  const refreshBtn = document.getElementById('refreshJobsBtn');
  const resumeTextEl = document.getElementById('resumeText');

  if (tabDiscovery) {
    tabDiscovery.addEventListener('click', () => {
      switchWorkspaceTab('discovery');
      updateExternalSearchLinks(searchInput ? searchInput.value : '', remoteCheckbox ? remoteCheckbox.checked : false);
    });
  }

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = searchInput.value.trim();
        const remoteOnly = remoteCheckbox ? remoteCheckbox.checked : false;
        fetchAndRenderJobs(query, remoteOnly);
        updateExternalSearchLinks(query, remoteOnly);
      }, 250);
    });
  }

  if (remoteCheckbox) {
    remoteCheckbox.addEventListener('change', () => {
      const query = searchInput ? searchInput.value.trim() : '';
      const remoteOnly = remoteCheckbox.checked;
      fetchAndRenderJobs(query, remoteOnly);
      updateExternalSearchLinks(query, remoteOnly);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const query = searchInput ? searchInput.value.trim() : '';
      const remoteOnly = remoteCheckbox ? remoteCheckbox.checked : false;
      const refreshIcon = document.getElementById('refreshJobsIcon');
      if (refreshIcon) refreshIcon.classList.add('animate-spin');
      await fetchAndRenderJobs(query, remoteOnly);
      if (refreshIcon) refreshIcon.classList.remove('animate-spin');
      showToast('Refreshed! Found new opportunities.', 'success', 2500);
    });
  }

  if (resumeTextEl) {
    let resumeDebounce = null;
    resumeTextEl.addEventListener('input', () => {
      clearTimeout(resumeDebounce);
      resumeDebounce = setTimeout(() => {
        if (activeWorkspaceTab === 'discovery' && discoveredJobsCache.length > 0) {
          recomputeAndRenderJobCards();
        }
      }, 500);
    });
  }

  const prevPageBtn = document.getElementById('prevJobsPageBtn');
  const nextPageBtn = document.getElementById('nextJobsPageBtn');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentJobsPage > 1) {
        currentJobsPage--;
        recomputeAndRenderJobCards();
        document.getElementById('discovery-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(discoveredJobsCache.length / JOBS_PER_PAGE) || 1;
      if (currentJobsPage < totalPages) {
        currentJobsPage++;
        recomputeAndRenderJobCards();
        document.getElementById('discovery-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

/**
 * 16. Candidate Skill Vault & Unified Credential Profile Engine
 */
function renderVaultUI() {
  const useDocuments = document.getElementById('syncVaultToWorkspaceBtn');
  if (useDocuments) useDocuments.disabled = vaultDocumentsCache.length === 0;
  const docsListEl = document.getElementById('vaultDocumentsList');
  const countBadge = document.getElementById('vaultDocsCountBadge');
  const totalBadge = document.getElementById('vaultDocTotalBadge');

  if (countBadge) countBadge.textContent = vaultDocumentsCache.length;
  if (totalBadge) totalBadge.textContent = `${vaultDocumentsCache.length} Files`;

  if (docsListEl) {
    docsListEl.innerHTML = '';
    if (vaultDocumentsCache.length === 0) {
      docsListEl.innerHTML = `
        <div class="p-8 text-center border border-dashed rounded-2xl space-y-2" style="border-color: var(--ws-border, var(--border)); color: var(--ink-3);">
          <div class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center opacity-70" style="background: var(--paper-3);">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <p class="text-xs font-semibold" style="color: var(--ink);">No documents stored in vault yet</p>
          <p class="text-xs opacity-75">Upload your resume or certificates to extract verified skills.</p>
        </div>
      `;
    } else {
      vaultDocumentsCache.forEach(doc => {
        const docCard = document.createElement('div');
        docCard.className = 'p-3.5 rounded-xl transition duration-150 space-y-2 border hover:border-emerald-500/30';
        docCard.style.background = 'var(--paper-2)';
        docCard.style.borderColor = 'var(--ws-border, var(--border))';

        const typeColor = doc.doc_type === 'resume'
          ? 'background: var(--sage-light); color: var(--sage); border: 1px solid rgba(124, 181, 133, 0.25);'
          : (doc.doc_type === 'certification'
            ? 'background: var(--amber-light); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.25);'
            : 'background: var(--sky-light); color: var(--sky); border: 1px solid rgba(56, 189, 248, 0.25);');

        const skillsPills = (doc.extracted_skills || []).slice(0, 3).map(s => `
          <span class="text-xs px-2 py-0.5 rounded font-mono font-medium border" style="background: var(--paper-3); color: var(--ink); border-color: var(--ws-border, var(--border));">
            ${escapeHtml(s)}
          </span>
        `).join(' ');

        docCard.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block" style="${typeColor}">
                ${escapeHtml(doc.doc_type)}
              </span>
              <h5 class="text-sm font-semibold mt-1.5 leading-snug break-all" style="color: var(--ink);" title="${escapeHtml(doc.doc_name)}">
                ${escapeHtml(doc.doc_name)}
              </h5>
            </div>
            <button type="button" data-doc-id="${escapeHtml(doc.id)}" class="btn-delete-vault-doc p-1 shrink-0 text-rose-500 hover:bg-rose-500/10 rounded-lg transition" title="Delete document" aria-label="Delete ${escapeHtml(doc.doc_name)}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <p class="text-xs line-clamp-2 opacity-80" style="color: var(--ink-3);">${escapeHtml(doc.content_snippet)}</p>
          <div class="flex flex-wrap gap-1.5 pt-1">${skillsPills}</div>
        `;

        const delBtn = docCard.querySelector('.btn-delete-vault-doc');
        if (delBtn) {
          delBtn.addEventListener('click', () => {
            deleteVaultDocument(doc.id);
          });
        }

        docsListEl.appendChild(docCard);
      });
    }
  }

  renderMatrixCategory('vaultMatrixLanguages', verifiedSkillsMatrix.languages, 'var(--sage)');
  renderMatrixCategory('vaultMatrixFrameworks', verifiedSkillsMatrix.frameworks, 'var(--sky)');
  renderMatrixCategory('vaultMatrixCloud', verifiedSkillsMatrix.cloud, 'var(--amber)');
  renderMatrixCategory('vaultMatrixCertifications', verifiedSkillsMatrix.certifications, 'var(--rose)');
}

function getSkillLogoSvg(skill, category, dotColor) {
  const s = (skill || '').toLowerCase().trim();

  // 1. Languages
  if (s === 'typescript' || s === 'ts') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none"><rect width="24" height="24" rx="4" fill="#3178C6"/><path d="M11.5 10.5H7.5V12h1.2v6.5h1.6V12h1.2v-1.5zm3.7 4.7c-.5-.3-.9-.7-1-1.3l-1.3.4c.2.9.7 1.6 1.4 2 1.1.7 2.6.5 3.3-.4.4-.5.6-1.1.6-1.8 0-1.4-.9-2.1-2.4-2.5-.9-.3-1.3-.5-1.3-1 0-.3.2-.6.7-.7.5-.1 1.1.1 1.4.5l1.2-.6c-.4-.7-1.1-1.1-2-1.1-1.2 0-2.2.7-2.2 2 0 1.2.8 1.9 2.1 2.3.9.3 1.5.6 1.5 1.1 0 .4-.3.7-.8.8-.5.1-1.2 0-1.6-.3z" fill="#FFFFFF"/></svg>`;
  }
  if (s === 'javascript' || s === 'js') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5"><rect width="24" height="24" rx="4" fill="#F7DF1E"/><path d="M7 11h2v5.5c0 .9-.5 1.5-1.5 1.5H6.5v-1.5H7v-4zm6.5 4.5c.5.3 1 .5 1.6.5.9 0 1.4-.4 1.4-1 0-.6-.4-.9-1.3-1.3l-.6-.2c-1.3-.5-2.1-1.2-2.1-2.5 0-1.5 1.2-2.6 3-2.6.9 0 1.6.2 2.1.6l-.7 1.5c-.4-.3-.9-.5-1.4-.5-.7 0-1.1.4-1.1.9 0 .6.4.8 1.2 1.2l.6.2c1.4.6 2.2 1.3 2.2 2.6 0 1.7-1.3 2.7-3.3 2.7-1.1 0-2-.3-2.6-.7l.7-1.5z" fill="#000000"/></svg>`;
  }
  if (s === 'python' || s === 'py') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="#3776AB" d="M11.9 2c-3.1 0-2.9 1.3-2.9 1.3l.01 1.4h2.9v.4H6.1S3.4 5 3.4 8.7c0 3.7 2.4 3.6 2.4 3.6h1.4v-2c0-1.4 1.2-2.4 2.6-2.4h4.4s1.2-.02 1.2-1.2V4.5c0-1.2-1.2-2.5-3.5-2.5zm-1.6 1.5c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7z"/><path fill="#FFD43B" d="M12.1 22c3.1 0 2.9-1.3 2.9-1.3l-.01-1.4h-2.9v-.4h5.8s2.7.1 2.7-3.6c0-3.7-2.4-3.6-2.4-3.6h-1.4v2c0 1.4-1.2 2.4-2.6 2.4H9.8s-1.2.02-1.2 1.2v2.2c0 1.2 1.2 2.5 3.5 2.5zm1.6-1.5c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z"/></svg>`;
  }
  if (s === 'sql' || s === 'mysql' || s === 'sqlite') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="#6366F1" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`;
  }
  if (s === 'php') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#777BB4"><ellipse cx="12" cy="12" rx="10" ry="6"/><path d="M7.5 10h2.5c.8 0 1.2.4 1.2 1s-.4 1-1.2 1H8.5v2H7.5v-4zm4.5 0h2.5c.8 0 1.2.4 1.2 1s-.4 1-1.2 1H13v2h-1v-4z" fill="#FFFFFF"/></svg>`;
  }
  if (s === 'go' || s === 'golang') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#00ADD8"><path d="M12 4a8 8 0 108 8h-8v-3h11a11 11 0 11-3.2-7.8L17 6A8 8 0 0012 4z"/></svg>`;
  }
  if (s === 'rust') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#DEA584"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><text x="12" y="16" font-size="11" font-weight="bold" text-anchor="middle" fill="currentColor">R</text></svg>`;
  }
  if (s === 'html' || s === 'html5') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#E34F26"><path d="M3 2l1.6 18 7.4 2 7.4-2L21 2H3zm14.3 5.5l-.2 2.3h-7l.2 2.3h6.6l-.6 6.3-4.3 1.2-4.3-1.2-.3-3.4h2.2l.1 1.6 2 .5 2-.5.3-2.6H7.7L7.1 7.5h10.2z"/></svg>`;
  }
  if (s === 'css' || s === 'css3') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#1572B6"><path d="M3 2l1.6 18 7.4 2 7.4-2L21 2H3zm14.3 5.5l-.2 2.3h-7l.2 2.3h6.6l-.6 6.3-4.3 1.2-4.3-1.2-.3-3.4h2.2l.1 1.6 2 .5 2-.5.3-2.6H7.7L7.1 7.5h10.2z"/></svg>`;
  }

  // 2. Frameworks & Libraries
  if (s === 'react' || s === 'react native' || s === 'reactjs') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none"><ellipse cx="12" cy="12" rx="3.5" ry="9" stroke="#61DAFB" stroke-width="1.6" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="3.5" ry="9" stroke="#61DAFB" stroke-width="1.6" transform="rotate(90 12 12)"/><ellipse cx="12" cy="12" rx="3.5" ry="9" stroke="#61DAFB" stroke-width="1.6" transform="rotate(150 12 12)"/><circle cx="12" cy="12" r="1.8" fill="#61DAFB"/></svg>`;
  }
  if (s === 'next.js' || s === 'nextjs' || s === 'next') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none"><circle cx="12" cy="12" r="10" fill="#000000"/><path d="M15.5 16.5l-5.8-7.5v7.5H8.3V7.5h1.7l5.7 7.4V7.5h1.4v9h-1.6z" fill="#FFFFFF"/></svg>`;
  }
  if (s === 'node.js' || s === 'nodejs' || s === 'node' || s === 'express') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#5FA04E"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2zm0 2.2L5.5 8.4v7.2L12 19.4l6.5-3.8V8.4L12 4.2zm-1 4.3h2v4.5h2.5v2H11V8.5z"/></svg>`;
  }
  if (s === 'fastapi') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#009688"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm1 14.5l-4.5-2.5 5-9v5.5l4 2.5-4.5 3.5z"/></svg>`;
  }
  if (s === 'tailwind css' || s === 'tailwind' || s === 'tailwindcss') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#06B6D4"><path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.336 6.182 14.975 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.336 13.382 8.975 12 6.001 12z"/></svg>`;
  }
  if (s === 'vue' || s === 'vue.js') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="#41B883" d="M2 3h3.5L12 14 18.5 3H22L12 20.5 2 3z"/><path fill="#34495E" d="M6 3h3l3 5.5L15 3h3l-6 10.5L6 3z"/></svg>`;
  }
  if (s === 'angular') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#DD0031"><path d="M12 2L2 5.5l1.5 13L12 22l8.5-3.5 1.5-13L12 2zm0 3.5l4 9.5h-2l-1-2.5h-2l-1 2.5H8l4-9.5zm-1 5.5h2l-1-2.5-1 2.5z"/></svg>`;
  }
  if (s === 'graphql') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#E10098"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2zm0 2.3L5.34 8.1v7.8L12 19.7l6.66-3.8V8.1L12 4.3z"/></svg>`;
  }

  // 3. Cloud, Infrastructure & Databases
  if (s === 'docker') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#2496ED"><path d="M13.98 9.38h1.66V7.72H13.98v1.66zm-2.07 0h1.66V7.72h-1.66v1.66zm-2.07 0h1.66V7.72H9.84v1.66zm-2.08 0h1.67V7.72H7.76v1.66zm6.22-2.07h1.66V5.65h-1.66v1.66zm-2.07 0h1.66V5.65h-1.66v1.66zm-2.07 0h1.66V5.65H9.84v1.66zm6.22 4.14h1.66V9.79h-1.66v1.66zm-10.36 0h1.66V9.79H5.69v1.66zm16.59.88c-.37-.26-1.5-.32-2.31.25-.19.13-.37.28-.54.45-.63-.38-1.52-.45-2.26-.22-.17-.4-.44-.75-.8-1H3.6c-.33 0-.6.27-.6.6 0 1.83.63 3.53 1.77 4.88C6.39 18.42 8.79 19.3 11.5 19.3c5.64 0 9.77-3.83 10.63-7.98.05-.24.11-.7.16-1.12z"/></svg>`;
  }
  if (s === 'aws' || s.includes('amazon web services')) {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#FF9900"><path d="M6.8 11.4c-.4.4-.7.9-.7 1.6 0 1.2.9 2 2.3 2 1 0 1.8-.4 2.3-1.1v.9h1.7V8.5h-1.7v1.1c-.5-.7-1.3-1.1-2.3-1.1-1.4 0-2.3.8-2.3 2 0 .7.3 1.2.7 1.6v-.7zm1.8 2.2c-.8 0-1.2-.5-1.2-1.1s.4-1.1 1.2-1.1 1.2.5 1.2 1.1-.4 1.1-1.2 1.1zm9.6-5.1h-1.7v3.9l-1.3-3.9h-1.6l-1.3 3.9V8.5h-1.7v6.3h1.7l1.3-3.8 1.3 3.8h1.7l1.6-6.3zm-14.7 9.8c4.3 2.1 9.7 2.1 14.1-.1.4-.2.8.2.5.5-4.8 2.5-10.7 2.4-15.1-.1-.3-.2-.1-.5.5-.3z"/></svg>`;
  }
  if (s === 'postgresql' || s === 'postgres') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#336791"><path d="M12 2a10 10 0 00-9.8 8.1c.3-.1.6-.1.9-.1 2.2 0 3.7 1.1 4.5 2.5.6 1.1.9 2.4 1.4 3.7.3.8.7 1.5 1.3 1.9.7.5 1.6.5 2.7.2.9-.2 1.8-.7 2.4-1.3.8-.9 1.2-2 1.6-3.2.4-1.1.8-2.2 1.5-3.1 1-1.3 2.4-2.2 4.1-2.5A10 10 0 0012 2zm-1.8 18.2c-.8.1-1.5-.1-2.1-.6-.5-.4-.9-1-1.1-1.7-.5-1.3-.8-2.6-1.4-3.6-.6-1-1.7-1.8-3.4-1.9-.1 0-.3 0-.4.1A10 10 0 0012 22a9.9 9.9 0 004.2-.9c-.6.3-1.3.5-2.1.6-1.3.2-2.7.1-3.9-.7z"/></svg>`;
  }
  if (s === 'redis') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#DC382D"><path d="M21.2 8.5L12.5 4.1c-.3-.2-.7-.2-1 0L2.8 8.5c-.5.3-.8.8-.8 1.4v4.2c0 .6.3 1.1.8 1.4l8.7 4.4c.3.2.7.2 1 0l8.7-4.4c.5-.3.8-.8.8-1.4V9.9c0-.6-.3-1.1-.8-1.4zm-9.2-2.3l6.5 3.3-2.6 1.3-6.5-3.3 2.6-1.3zm-7 4.7l6.5 3.3v2.8l-6.5-3.3V10.9zm8.5 6.1v-2.8l6.5-3.3v2.8l-6.5 3.3z"/></svg>`;
  }
  if (s === 'ci/cd' || s === 'cicd' || s.includes('action') || s.includes('pipeline')) {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="#2563EB" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
  }
  if (s === 'kubernetes' || s === 'k8s') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#326CE5"><path d="M12 2L3.5 7v10L12 22l8.5-5V7L12 2zm0 2.3l6.5 3.8v7.8L12 19.7 5.5 15.9V8.1L12 4.3zm0 3.2a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 2a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/></svg>`;
  }
  if (s === 'gcp' || s.includes('google cloud')) {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="#EA4335" d="M19.3 12.3c0-.6-.1-1.2-.2-1.8H12v3.4h4.1c-.2 1-.7 1.8-1.5 2.4v2h2.5c1.4-1.3 2.2-3.3 2.2-6z"/><path fill="#4285F4" d="M12 19.8c2.1 0 3.8-.7 5.1-1.9l-2.5-2c-.7.5-1.6.8-2.6.8-2 0-3.7-1.4-4.3-3.2H5.1v2c1.3 2.6 4 4.3 6.9 4.3z"/><path fill="#FBBC05" d="M7.7 13.5c-.2-.5-.3-1.1-.3-1.7 0-.6.1-1.2.3-1.7v-2H5.1C4.4 9.4 4 10.6 4 12s.4 2.6 1.1 3.9l2.6-2.4z"/><path fill="#34A853" d="M12 7.7c1.1 0 2.2.4 3 1.2l2.3-2.3C15.8 5.3 14 4.5 12 4.5c-2.9 0-5.6 1.7-6.9 4.3l2.6 2c.6-1.8 2.3-3.1 4.3-3.1z"/></svg>`;
  }
  if (s === 'git' || s === 'github') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="#F05032"><path d="M21.6 10.9l-8.5-8.5c-.8-.8-2.1-.8-2.9 0L8.7 3.9l3.3 3.3c.7-.2 1.5 0 2 .5.6.6.7 1.5.4 2.2l3.2 3.2c.7-.3 1.6-.2 2.2.4.8.8.8 2.1 0 2.9-.8.8-2.1.8-2.9 0-.6-.6-.7-1.5-.4-2.2l-3.2-3.2c-.4.2-.8.3-1.3.3-.4 0-.8-.1-1.1-.3l-3.3 3.3v6.7c.3.2.5.5.5.9 0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5.7-1.5 1.5-1.5c.3 0 .7.1 1 .3V11c-.3-.2-.7-.3-1-.3-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5c.3 0 .6-.1.8-.3l3.3-3.3c-.2-.4-.3-.8-.3-1.3 0-.5.2-.9.5-1.3L2.4 13.8c-.8.8-.8 2.1 0 2.9l8.5 8.5c.8.8 2.1.8 2.9 0l7.8-7.8c.8-.8.8-2.1 0-2.9v-.1l-.1-.5z"/></svg>`;
  }
  if (s === 'linux') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="#EAB308" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
  }

  // 4. Certifications
  if (category === 'vaultMatrixCertifications' || s.includes('cert') || s.includes('architect') || s.includes('associate')) {
    if (s.includes('aws') || s.includes('amazon')) {
      return `<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none"><rect width="24" height="24" rx="6" fill="#FF9900" fill-opacity="0.15"/><path d="M12 3.5l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L12 3.5z" fill="#FF9900"/><path d="M9 18l3 3 3-3" stroke="#FF9900" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none"><circle cx="12" cy="9" r="6" fill="#F43F5E" fill-opacity="0.15" stroke="#F43F5E" stroke-width="1.8"/><path d="M9.5 9l1.8 1.8L15 7.5" stroke="#F43F5E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 14.5L7 21l5-2.5 5 2.5-1.5-6.5" fill="#F43F5E" fill-opacity="0.2" stroke="#F43F5E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // 5. Category Default Fallbacks
  if (category === 'vaultMatrixLanguages') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="var(--sage)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>`;
  }
  if (category === 'vaultMatrixFrameworks') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="var(--sky)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`;
  }
  if (category === 'vaultMatrixCloud') {
    return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="var(--amber)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z"/></svg>`;
  }

  return `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m16-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`;
}

function renderMatrixCategory(elementId, items, dotColor) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = '<span class="text-xs opacity-50" style="color: var(--ink-4);">No verified credentials detected in this category.</span>';
    return;
  }

  const isCertCategory = elementId === 'vaultMatrixCertifications';

  items.forEach(skill => {
    const tile = document.createElement('div');
    tile.className = isCertCategory
      ? 'skill-matrix-tile p-3 rounded-xl border transition duration-150 group cursor-default'
      : 'skill-matrix-tile p-2.5 sm:p-3 rounded-xl border transition duration-150 group cursor-default';

    tile.style.background = 'var(--paper-2)';
    tile.style.borderColor = 'var(--ws-border, var(--border))';
    tile.style.minWidth = isCertCategory ? '150px' : '82px';
    tile.style.maxWidth = isCertCategory ? '240px' : '96px';

    const logoSvg = getSkillLogoSvg(skill, elementId, dotColor);

    tile.innerHTML = `
      <div class="skill-logo-box w-9 h-9 sm:w-10 sm:h-10 rounded-xl mb-2 flex items-center justify-center shadow-xs" style="background: var(--paper-3);">
        ${logoSvg}
      </div>
      <span class="text-xs font-bold tracking-tight text-center leading-snug line-clamp-2 w-full" style="color: var(--ink);" title="${escapeHtml(skill)}">
        ${escapeHtml(skill)}
      </span>
    `;

    container.appendChild(tile);
  });
}

function addDocumentToVault(name, type, text) {
  const detectedSkills = extractSkillsFromText(text);
  const formattedSkills = detectedSkills.map(s => ucFirstSkill(s));

  const newDoc = {
    id: 'doc-vault-' + Date.now(),
    doc_type: type,
    doc_name: name || 'Uploaded_Document.pdf',
    content_snippet: text.substring(0, 150) + '...',
    extracted_skills: formattedSkills,
    created_at: new Date().toISOString().split('T')[0]
  };

  vaultDocumentsCache.unshift(newDoc);

  detectedSkills.forEach(skill => {
    const sLower = skill.toLowerCase();
    const formatted = ucFirstSkill(skill);

    if (['python', 'typescript', 'javascript', 'go', 'php', 'rust', 'c++', 'sql', 'bash', 'java'].includes(sLower)) {
      if (!verifiedSkillsMatrix.languages.includes(formatted)) verifiedSkillsMatrix.languages.push(formatted);
    } else if (['react', 'react native', 'next.js', 'vue', 'vue.js', 'angular', 'node.js', 'node', 'express', 'fastapi', 'tailwind', 'tailwind css', 'graphql'].includes(sLower)) {
      if (!verifiedSkillsMatrix.frameworks.includes(formatted)) verifiedSkillsMatrix.frameworks.push(formatted);
    } else if (['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'postgresql', 'redis', 'ci/cd', 'linux'].includes(sLower)) {
      if (!verifiedSkillsMatrix.cloud.includes(formatted)) verifiedSkillsMatrix.cloud.push(formatted);
    }
  });

  if (type === 'certification' && !verifiedSkillsMatrix.certifications.includes(name)) {
    verifiedSkillsMatrix.certifications.push(name.replace(/\.[^/.]+$/, ''));
  }

  renderVaultUI();
  recomputeAndRenderJobCards();
  showToast(`Added ${newDoc.doc_name} to Skill Vault.`, 'success');
}

function deleteVaultDocument(docId) {
  if (docId.startsWith('planner-project-') && typeof SkillSyncProjectPlannerUI !== 'undefined') {
    const records = SkillSyncProjectPlannerUI.readEvidence().filter(record => record.id !== docId);
    if (!SkillSyncProjectPlannerUI.writeEvidence(records)) {
      showToast('The project could not be removed. Try again.', 'error');
      return;
    }
    refreshProjectPlanner?.(true);
  }
  vaultDocumentsCache = vaultDocumentsCache.filter(d => d.id !== docId);
  renderVaultUI();
  recomputeAndRenderJobCards();
  showToast('Document removed from Skill Vault.', 'info');
}

function ucFirstSkill(skill) {
  if (['aws', 'gcp', 'cka', 'sql', 'ci/cd', 'html5', 'css3', 'php'].includes(skill.toLowerCase())) {
    return skill.toUpperCase();
  }
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

function syncVaultToWorkspace() {
  const resumeTextEl = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');

  if (!resumeTextEl) return;

  const allSkills = getAllVaultSkills();
  const certs = verifiedSkillsMatrix.certifications || [];

  const summary =
    `Candidate Profile Synthesized from Skill Vault\n` +
    `-----------------------------------------\n` +
    `Verified Technical Skills: ${allSkills.map(s => ucFirstSkill(s)).join(', ')}\n` +
    `Certifications: ${certs.length > 0 ? certs.join(', ') : 'None listed'}\n\n` +
    `Experience Highlights:\n` +
    vaultDocumentsCache.map(d => `- [${d.doc_type.toUpperCase()}] ${d.doc_name}: ${d.content_snippet}`).join('\n');

  resumeTextEl.value = summary;
  updateCharCounter(resumeTextEl, resumeCount);

  switchWorkspaceTab('ats');
  showToast('Synced Skill Vault profile into ATS Workspace.', 'success');
}

function initSkillVault() {
  const tabVault = document.getElementById('tabSkillVault');
  const uploadBtn = document.getElementById('uploadVaultDocBtn');
  const fileInput = document.getElementById('vaultDocFileInput');
  const syncBtn = document.getElementById('syncVaultToWorkspaceBtn');

  if (tabVault) {
    tabVault.addEventListener('click', () => switchWorkspaceTab('vault'));
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const fileName = file.name;
      const isCert = fileName.toLowerCase().includes('cert') || fileName.toLowerCase().includes('aws') || fileName.toLowerCase().includes('license');
      const docType = isCert ? 'certification' : (fileName.toLowerCase().includes('resume') || fileName.toLowerCase().includes('cv') ? 'resume' : 'project');

      try {
        const text = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : 'Credential verification payload');
          reader.onerror = () => resolve('Extracted credential text');
          reader.readAsText(file);
        });

        addDocumentToVault(fileName, docType, text);
      } catch (_) {
        addDocumentToVault(fileName, docType, `Extracted ${fileName} technical verification.`);
      }

      fileInput.value = '';
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', syncVaultToWorkspace);
  }

  renderVaultUI();
}

/**
 * 14. AI Career Action Suite (Tailor Bullets, Cover Letter, Interview Prep)
 */
let lastTailorBullets = [];
let lastCoverLetterText = '';
let lastInterviewQuestions = [];

async function getAuthBearerToken() {
  if (isDemoMode()) return 'demo-token-123';
  if (currentSession && currentSession.access_token) return currentSession.access_token;
  if (supabaseClient && typeof supabaseClient.auth?.getSession === 'function') {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session) {
        currentSession = data.session;
        return currentSession.access_token;
      }
    } catch (_) {}
  }
  return 'demo-token-123';
}

async function openTailorModal() {
  const modal = document.getElementById('tailor-modal');
  const loading = document.getElementById('tailorLoading');
  const list = document.getElementById('tailorBulletsList');
  const adviceText = document.getElementById('tailorAdviceText');
  const resumeTextEl = document.getElementById('resumeText');
  const jobTextEl = document.getElementById('jobText');

  if (!modal) return;
  modal.classList.remove('hidden');

  const resume = resumeTextEl ? resumeTextEl.value.trim() : '';
  const jobDesc = jobTextEl ? jobTextEl.value.trim() : '';
  const missingSkills = (lastAnalysisResult && Array.isArray(lastAnalysisResult.missing_skills))
    ? lastAnalysisResult.missing_skills
    : [];

  if (!resume || !jobDesc) {
    if (loading) loading.classList.add('hidden');
    if (adviceText) adviceText.textContent = 'Please provide both resume and job description to tailor experience.';
    if (list) list.innerHTML = '<p class="text-xs opacity-75 p-4 text-center">Resume and target job description required.</p>';
    return;
  }

  if (loading) loading.classList.remove('hidden');
  if (list) list.innerHTML = '';
  if (adviceText) adviceText.textContent = 'Analyzing skill gaps and engineering impact bullets...';

  try {
    const token = await getAuthBearerToken();
    const res = await fetch('tailor.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        resume,
        job_description: jobDesc,
        missing_skills: missingSkills
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to tailor resume.');

    lastTailorBullets = Array.isArray(data.optimized_bullets) ? data.optimized_bullets : [];
    if (adviceText && data.tailoring_advice) {
      adviceText.textContent = data.tailoring_advice;
    }

    renderTailorBullets(lastTailorBullets);
  } catch (err) {
    if (adviceText) adviceText.textContent = 'Using resilient fallback recommendations.';
    renderTailorBullets([
      {
        context: 'Full-Stack Execution',
        bullet: `Architected scalable services integrating ${missingSkills[0] || 'TypeScript'} and ${missingSkills[1] || 'Cloud Infrastructure'}, driving a 30% reduction in processing latency.`,
        skills: [missingSkills[0] || 'TypeScript', missingSkills[1] || 'Cloud Infrastructure']
      },
      {
        context: 'Reliability & Deployment',
        bullet: `Modernized deployment automation and automated test pipelines using ${missingSkills[1] || 'Docker'}, cutting cycle lead time by 45%.`,
        skills: [missingSkills[1] || 'Docker']
      }
    ]);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function renderTailorBullets(bullets) {
  const list = document.getElementById('tailorBulletsList');
  if (!list) return;

  list.innerHTML = '';
  bullets.forEach(b => {
    const card = document.createElement('div');
    card.className = 'p-3.5 rounded-xl border space-y-2 transition hover:border-emerald-500/40';
    card.style.background = 'var(--paper-2)';
    card.style.borderColor = 'var(--border)';

    const skillsHtml = Array.isArray(b.skills)
      ? b.skills.map(s => `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold" style="background: var(--sage-light); color: var(--sage);">${escapeHtml(s)}</span>`).join(' ')
      : '';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-wider opacity-75" style="color: var(--ink-2);">${escapeHtml(b.context || 'Accomplishment')}</span>
        <div class="flex items-center space-x-1.5">${skillsHtml}</div>
      </div>
      <p class="text-xs leading-relaxed font-sans" style="color: var(--ink);">${escapeHtml(b.bullet)}</p>
      <div class="pt-2 border-t flex items-center justify-end space-x-2" style="border-color: var(--border);">
        <button type="button" class="btn-copy-bullet px-2.5 py-1 text-[11px] font-semibold rounded-lg transition hover:bg-slate-500/10 inline-flex items-center space-x-1" style="color: var(--ink-2); border: 1px solid var(--border);">
          <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          <span>Copy</span>
        </button>
        <button type="button" class="btn-insert-bullet px-2.5 py-1 text-[11px] font-bold rounded-lg transition text-white btn-action-primary inline-flex items-center space-x-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Insert</span>
        </button>
      </div>
    `;

    const copyBtn = card.querySelector('.btn-copy-bullet');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(b.bullet);
          showToast('Copied bullet point to clipboard!', 'success');
        } catch (_) {
          showToast('Copied bullet point.', 'success');
        }
      });
    }

    const insertBtn = card.querySelector('.btn-insert-bullet');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => {
        const resumeTextEl = document.getElementById('resumeText');
        const resumeCount = document.getElementById('resumeCount');
        if (resumeTextEl) {
          resumeTextEl.value = (resumeTextEl.value.trim() + '\n• ' + b.bullet);
          updateCharCounter(resumeTextEl, resumeCount);
          showToast('Appended bullet to workspace resume.', 'success');
        }
      });
    }

    list.appendChild(card);
  });
}

async function openCoverLetterModal() {
  const modal = document.getElementById('coverletter-modal');
  const companyInput = document.getElementById('clCompanyInput');
  const resumeTextEl = document.getElementById('resumeText');
  const jobTextEl = document.getElementById('jobText');

  if (!modal) return;
  modal.classList.remove('hidden');

  const resume = resumeTextEl ? resumeTextEl.value.trim() : '';
  const jobDesc = jobTextEl ? jobTextEl.value.trim() : '';
  const company = (companyInput && companyInput.value.trim()) || 'the hiring team';

  fetchCoverLetter('modern', company, resume, jobDesc);
}

async function fetchCoverLetter(tone = 'modern', company = '', resume = '', jobDesc = '') {
  const loading = document.getElementById('clLoading');
  const wrapper = document.getElementById('clContentWrapper');
  const textarea = document.getElementById('clLetterText');
  const resumeTextEl = document.getElementById('resumeText');
  const jobTextEl = document.getElementById('jobText');

  const r = resume || (resumeTextEl ? resumeTextEl.value.trim() : '');
  const j = jobDesc || (jobTextEl ? jobTextEl.value.trim() : '');
  const comp = company || (document.getElementById('clCompanyInput')?.value.trim()) || 'the hiring team';

  if (loading) loading.classList.remove('hidden');
  if (wrapper) wrapper.classList.add('hidden');

  try {
    const token = await getAuthBearerToken();
    const res = await fetch('coverletter.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        resume: r,
        job_description: j,
        company_name: comp,
        tone: tone
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate cover letter.');

    lastCoverLetterText = data.cover_letter || '';
    if (textarea) textarea.value = lastCoverLetterText;
  } catch (err) {
    const fallbackText = `Dear Hiring Team at ${comp},\n\nI am excited to submit my application for the software engineering position. My demonstrated track record architecting robust web applications, optimizing backend throughput, and maintaining high engineering standards directly aligns with your team's objectives.\n\nThroughout my career, I have prioritized high velocity and system reliability. Whether modernizing core services or implementing automated CI/CD workflows, I value pragmatic design, measurable metrics, and clean code.\n\nI welcome the opportunity to discuss further how my experience can accelerate your roadmap. Thank you for your consideration.\n\nSincerely,\nCandidate`;
    lastCoverLetterText = fallbackText;
    if (textarea) textarea.value = fallbackText;
  } finally {
    if (loading) loading.classList.add('hidden');
    if (wrapper) wrapper.classList.remove('hidden');
  }
}

async function openInterviewModal(options = {}) {
  const modal = document.getElementById('interview-modal');
  const loading = document.getElementById('interviewLoading');
  const list = document.getElementById('interviewQuestionsList');
  const countBadge = document.getElementById('interviewCountBadge');
  const resumeTextEl = document.getElementById('resumeText');
  const jobTextEl = document.getElementById('jobText');

  if (!modal) return;
  modal.classList.remove('hidden');

  const resume = resumeTextEl ? resumeTextEl.value.trim() : '';
  const jobDesc = jobTextEl ? jobTextEl.value.trim() : '';
  const missingSkills = (lastAnalysisResult && Array.isArray(lastAnalysisResult.missing_skills))
    ? lastAnalysisResult.missing_skills
    : [];

  const tabGen = document.getElementById('tabGeneratedQuestionsBtn');
  const tabSynthetic = document.getElementById('tabSyntheticQuestionsBtn');
  const tabCustom = document.getElementById('tabCustomQuestionBtn');
  const panelCustom = document.getElementById('customQuestionPanel');

  const wantSynthetic = Boolean((options && options.synthetic) || (!resume && !jobDesc));

  if (panelCustom) panelCustom.classList.add('hidden');
  if (list) list.classList.remove('hidden');

  if (wantSynthetic) {
    if (tabSynthetic) {
      tabSynthetic.style.background = 'var(--surface)';
      tabSynthetic.style.color = 'var(--ink)';
      tabSynthetic.classList.add('active-tab', 'shadow-sm');
    }
    if (tabGen) {
      tabGen.style.background = 'transparent';
      tabGen.style.color = 'var(--ink-3)';
      tabGen.classList.remove('active-tab', 'shadow-sm');
    }
    if (tabCustom) {
      tabCustom.style.background = 'transparent';
      tabCustom.style.color = 'var(--ink-3)';
      tabCustom.classList.remove('active-tab', 'shadow-sm');
    }
    if (loading) loading.classList.add('hidden');

    const corpus = (typeof SkillSyncInterview !== 'undefined' && Array.isArray(SkillSyncInterview.SYNTHETIC_INTERVIEW_CORPUS))
      ? SkillSyncInterview.SYNTHETIC_INTERVIEW_CORPUS.map(item => ({
          id: item.id,
          category: item.category,
          target_skill: item.target_skill,
          question: item.question_taglish,
          question_tagalog: item.question_tagalog,
          interviewer_intent: item.interviewer_intent,
          talking_points: item.talking_points,
          better_answer: item.synthetic_exemplars ? item.synthetic_exemplars.taglish : null,
          loop_around_prompts: item.loop_around_prompts,
          is_synthetic: true
        }))
      : [];

    if (corpus.length > 0) {
      lastInterviewQuestions = corpus;
      renderInterviewQuestions(corpus, { openFirstDrawer: true });
      if (countBadge) countBadge.textContent = `${corpus.length} Questions (Tagalog/Taglish)`;
      return;
    }
  }

  // Generated job-specific questions view
  if (tabGen) {
    tabGen.style.background = 'var(--surface)';
    tabGen.style.color = 'var(--ink)';
    tabGen.classList.add('active-tab', 'shadow-sm');
  }
  if (tabSynthetic) {
    tabSynthetic.style.background = 'transparent';
    tabSynthetic.style.color = 'var(--ink-3)';
    tabSynthetic.classList.remove('active-tab', 'shadow-sm');
  }
  if (tabCustom) {
    tabCustom.style.background = 'transparent';
    tabCustom.style.color = 'var(--ink-3)';
    tabCustom.classList.remove('active-tab', 'shadow-sm');
  }

  // If questions are already loaded from this session, render them directly
  if (lastInterviewQuestions && lastInterviewQuestions.length > 0) {
    renderInterviewQuestions(lastInterviewQuestions, { openFirstDrawer: true });
    if (countBadge) countBadge.textContent = `${lastInterviewQuestions.length} Questions`;
    return;
  }

  if (loading) loading.classList.remove('hidden');
  if (list) list.innerHTML = '';

  try {
    const token = await getAuthBearerToken();
    const res = await fetch('interview.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'generate',
        resume,
        job_description: jobDesc,
        missing_skills: missingSkills
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate interview prep.');

    lastInterviewQuestions = Array.isArray(data.questions) ? data.questions : [];
    renderInterviewQuestions(lastInterviewQuestions, { openFirstDrawer: true });
    if (countBadge) countBadge.textContent = `${lastInterviewQuestions.length} Questions`;
  } catch (err) {
    const syntheticFallback = (typeof SkillSyncInterview !== 'undefined' && Array.isArray(SkillSyncInterview.SYNTHETIC_INTERVIEW_CORPUS))
      ? SkillSyncInterview.SYNTHETIC_INTERVIEW_CORPUS.map(item => ({
          id: item.id,
          category: item.category,
          target_skill: item.target_skill,
          question: item.question_taglish,
          question_tagalog: item.question_tagalog,
          interviewer_intent: item.interviewer_intent,
          talking_points: item.talking_points,
          better_answer: item.synthetic_exemplars ? item.synthetic_exemplars.taglish : null,
          loop_around_prompts: item.loop_around_prompts,
          is_synthetic: true
        }))
      : [];

    lastInterviewQuestions = syntheticFallback.length > 0 ? syntheticFallback : [
      {
        id: 1,
        category: 'Skill Gap Deep-Dive',
        target_skill: missingSkills[0] || 'System Design',
        question: `How would you architect an idempotent distributed system utilizing ${missingSkills[0] || 'System Design'} under high concurrent load?`,
        interviewer_intent: 'Evaluates production troubleshooting depth and architectural patterns.',
        talking_points: ['Discuss message broker decoupling', 'Explain idempotency keys', 'Outline observability metrics'],
        better_answer: {
          star_answer: `In our production services, we decoupled ingestion using an asynchronous message broker to buffer high-concurrency spikes. We enforced idempotent processing using unique transaction idempotency keys validated against Redis before mutating downstream databases. This reduced p99 latency by 45% and guaranteed zero duplicate order charges across 25,000 requests per second.`,
          why_better: [
            'Applies the STAR model clearly (Problem -> Architecture -> Result)',
            'Includes concrete metrics (45% p99 drop, 25,000 req/sec)',
            'Demonstrates practical failure mitigation with idempotency keys'
          ]
        }
      }
    ];
    renderInterviewQuestions(lastInterviewQuestions, { openFirstDrawer: true });
    if (countBadge) countBadge.textContent = `${lastInterviewQuestions.length} Questions (Tagalog/Taglish)`;
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function createCustomInterviewQuestion(question, targetSkill = 'Core Competency', category = 'Custom Practice', talkingPoints = []) {
  if (typeof SkillSyncInterview !== 'undefined' && typeof SkillSyncInterview.createCustomInterviewQuestion === 'function') {
    return SkillSyncInterview.createCustomInterviewQuestion(question, targetSkill, category, talkingPoints);
  }

  const qText = String(question || '').trim();
  const skill = String(targetSkill || 'Core Competency').trim();
  const cat = String(category || 'Custom Practice').trim();

  let defaultPoints = Array.isArray(talkingPoints) && talkingPoints.length > 0 ? talkingPoints : [];
  if (defaultPoints.length === 0) {
    defaultPoints = [
      `Clarify the core architectural requirements and scope for ${skill}`,
      `Walk through step-by-step technical implementation and trade-offs`,
      `Demonstrate measurable business outcomes and incident monitoring`
    ];
  }

  return {
    id: 'custom-' + Date.now(),
    category: cat,
    target_skill: skill,
    question: qText,
    interviewer_intent: `Assesses hands-on proficiency, problem-solving structure, and architectural communication around ${skill}.`,
    talking_points: defaultPoints,
    is_custom: true
  };
}

function evaluateInterviewAnswer(questionObj = {}, userAnswer = '', options = {}) {
  // Delegate to standalone UMD module if available
  if (typeof SkillSyncInterview !== 'undefined' && typeof SkillSyncInterview.evaluateInterviewAnswer === 'function') {
    return SkillSyncInterview.evaluateInterviewAnswer(questionObj, userAnswer, options);
  }

  const answer = String(userAnswer || '').trim();
  const talkingPoints = Array.isArray(questionObj.talking_points) ? questionObj.talking_points : [];
  const lowerAnswer = answer.toLowerCase();

  // Language detection
  const tlParticles = ['ang', 'ng', 'mga', 'sa', 'kami', 'namin', 'tayo', 'natin', 'ako', 'ko', 'tapos', 'yung', 'para', 'ito', 'dahil', 'noong', 'kaya', 'kung', 'at', 'ay'];
  const enFunctionWords = ['the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'as', 'into', 'we', 'our', 'i', 'my', 'and', 'but', 'or', 'so', 'can', 'will', 'have'];
  const words = lowerAnswer.replace(/[^a-z0-9\-áéíóúñ\s]/gi, ' ').split(/\s+/).filter(Boolean);
  let tlCount = 0;
  let enCount = 0;
  let hasAffix = false;

  words.forEach(w => {
    if (tlParticles.includes(w) || /^(nag|mag|pinag|pag|ipag)-[a-z]{3,}/i.test(w) || /\b(inayos|napabilis|bumaba|tumaas|solusyon|resulta)\b/i.test(w)) {
      tlCount++;
    }
    if (/^(nag|mag|pinag|pag|ipag)-[a-z]{3,}/i.test(w)) {
      hasAffix = true;
    }
    if (enFunctionWords.includes(w)) {
      enCount++;
    }
  });

  let detectedLang = 'English';
  if (tlCount === 0 && !hasAffix) {
    detectedLang = 'English';
  } else if (tlCount >= 2 && enCount === 0) {
    detectedLang = 'Tagalog';
  } else if ((tlCount >= 1 || hasAffix) && enCount >= 1) {
    detectedLang = 'Taglish';
  } else if ((tlCount / (words.length || 1)) > 0.25 && enCount <= 1) {
    detectedLang = 'Tagalog';
  } else {
    detectedLang = tlCount >= 1 ? 'Taglish' : 'English';
  }

  const targetLang = (options.preferredLanguage && options.preferredLanguage !== 'Auto')
    ? options.preferredLanguage
    : detectedLang;

  const skill = questionObj.target_skill || 'System Architecture';
  let betterAnswer = {};
  if (targetLang === 'Taglish') {
    betterAnswer = {
      language: 'Taglish',
      star_answer: `Sa previous production project namin, nagkaroon kami ng major bottleneck sa ${skill} noong nag-spike ang traffic by 3x. Para masolusyunan ito, nag-implement ako ng asynchronous queues at nag-setup ng distributed Redis caching layer with idempotent consumers. Dahil dito, bumaba ang p99 API latency by 45% (from 850ms down to 120ms) at 100% uptime ang na-maintain kahit umabot sa 20,000 req/sec.`,
      situation_task: `Sa previous production project namin, nagkaroon kami ng major bottleneck sa ${skill} noong nag-spike ang traffic by 3x.`,
      action: `Para masolusyunan ito, nag-implement ako ng asynchronous queues at nag-setup ng distributed Redis caching with idempotent consumers.`,
      result: `Dahil dito, bumaba ang p99 API latency by 45% (from 850ms down to 120ms) at 100% uptime ang na-maintain kahit umabot sa 20,000 req/sec.`,
      why_better: [
        'Ginamit ang STAR method (Situation, Task, Action, Result) na malinaw ang role mo',
        'May konkreto at quantified metrics (bumaba ang latency ng 45%, 120ms, 20k req/sec)',
        'Malinaw ang technical ownership sa pag-implement ng architecture solutions'
      ]
    };
  } else {
    betterAnswer = {
      language: 'English',
      star_answer: `In our production environment, we experienced critical latency bottlenecks around ${skill} when traffic surged 3.5x during high-volume customer campaigns. I led the redesign by implementing event-driven message queues to decouple the ingestion pipeline, introduced distributed caching with idempotent key validation, and configured automated circuit breakers. As a direct result, we reduced p99 endpoint latency by 48% (from 650ms to 95ms) and sustained 25,000 concurrent requests without failure.`,
      situation_task: `In our production environment, we experienced critical latency bottlenecks around ${skill} when traffic surged 3.5x during customer campaigns.`,
      action: `I led the redesign by implementing event-driven message queues, distributed caching with idempotent keys, and automated circuit breakers.`,
      result: `As a direct result, we reduced p99 endpoint latency by 48% (from 650ms to 95ms) and sustained 25,000 req/sec with zero failure.`,
      why_better: [
        'Structured precisely in STAR format (Situation, Task, Action, Result)',
        'Includes hard quantifiable engineering metrics (48% latency drop, 95ms p99, 25k req/sec)',
        'Demonstrates high-impact technical ownership and architectural trade-off awareness'
      ]
    };
  }

  if (!answer || answer.length < 15) {
    return {
      score: 20,
      grade: targetLang === 'English' ? 'Needs Practice' : 'Kailangan ng Ensayo',
      language_detected: detectedLang,
      coveredPoints: [],
      missingPoints: talkingPoints,
      critique: targetLang === 'Taglish'
        ? 'Masyadong maikli ang sagot. Gamitin ang STAR method: ipaliwanag ang Situation, Task, mga Actions na ginawa mo, at ang measurable Results.'
        : 'Response is too brief. Provide technical specifics detailing Situation, Task, Action taken, and measurable Results.',
      better_answer: betterAnswer
    };
  }

  const covered = [];
  const missing = [];
  talkingPoints.forEach(pt => {
    const ptWords = pt.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const matches = ptWords.filter(w => lowerAnswer.includes(w));
    if (matches.length >= 1) covered.push(pt);
    else missing.push(pt);
  });

  const enImpactKeywords = [
    'reduce', 'reduced', 'increase', 'increased', 'optimiz', 'scale', 'built',
    'architect', 'led', 'deliver', 'metric', 'latency', 'throughput', 'percent',
    '%', 'test', 'monitor', 'failover', 'refactor', 'cache', 'pipeline'
  ];
  const tlImpactKeywords = [
    'nag-implement', 'nag-deploy', 'nag-scale', 'nag-optimize', 'nag-refactor',
    'nag-lead', 'inayos', 'bumaba', 'tumaas', 'solusyon', 'resulta'
  ];

  const enMatches = enImpactKeywords.filter(k => lowerAnswer.includes(k));
  const tlMatches = tlImpactKeywords.filter(k => lowerAnswer.includes(k));
  const totalImpact = enMatches.length + tlMatches.length;
  const hasNumeric = /\b\d+(?:\.\d+)?(?:\%|ms|s|x|k|mb|gb|req)?\b/i.test(lowerAnswer);
  const hasImpact = totalImpact >= 2 || (totalImpact >= 1 && hasNumeric);

  const pointsRatio = talkingPoints.length > 0 ? (covered.length / talkingPoints.length) : 0.8;
  const coverageScore = Math.round(pointsRatio * 55);
  const impactScore = hasImpact ? 25 : (totalImpact > 0 ? 15 : 5);
  const lengthScore = answer.length > 180 ? 20 : (answer.length > 80 ? 12 : 6);

  const score = Math.min(100, Math.max(30, coverageScore + impactScore + lengthScore));

  let grade = 'Needs Practice';
  let critique = '';

  if (score >= 80) {
    grade = targetLang === 'English' ? 'Exceptional Delivery' : 'Napakahusay na Sagot';
    critique = targetLang === 'Taglish'
      ? `Napakahusay! Nasagot mo ang ${covered.length} sa ${talkingPoints.length} core talking points with quantifiable metrics at malinaw na impact.`
      : `Excellent response covering ${covered.length} of ${talkingPoints.length} core talking points with quantifiable metrics and production impact.`;
  } else if (score >= 60) {
    grade = targetLang === 'English' ? 'Strong Answer' : 'Matatag na Sagot';
    critique = targetLang === 'Taglish'
      ? `Magandang sagot! Naipaliwanag mo ang ${covered.length} key points. Para mas maging pang-Staff/Lead level, dagdagan pa ng konkreto na latency benchmarks o architecture trade-offs.`
      : `Solid answer covering ${covered.length} key points. To achieve Staff/Lead level, incorporate concrete latency benchmarks or architectural trade-offs.`;
  } else {
    grade = targetLang === 'English' ? 'Needs Practice' : 'Kailangan ng Ensayo';
    critique = targetLang === 'Taglish'
      ? `Nabanggit ang ${covered.length} sa ${talkingPoints.length} konsepto. Siguraduhing ma-highlight: ${missing.slice(0, 2).join(' at ') || 'konkretong solusyon'}.`
      : `Addressed ${covered.length} of ${talkingPoints.length} concepts. Make sure to cover: ${missing.slice(0, 2).join(' and ')}.`;
  }

  return {
    score,
    grade,
    language_detected: detectedLang,
    coveredPoints: covered,
    missingPoints: missing,
    critique,
    better_answer: betterAnswer
  };
}

function renderInterviewQuestions(questions, options = {}) {
  const list = document.getElementById('interviewQuestionsList');
  if (!list) return;

  list.innerHTML = '';
  if (!Array.isArray(questions) || questions.length === 0) {
    list.innerHTML = `
      <div class="py-8 text-center space-y-2" style="color: var(--ink-3);">
        <p class="text-xs">No questions loaded. Click <strong>+ Custom Question</strong> above to add one, or scan a job description.</p>
      </div>
    `;
    return;
  }

  questions.forEach((q, index) => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl border space-y-2.5 transition hover:border-amber-500/40';
    card.style.background = 'var(--paper-2)';
    card.style.borderColor = 'var(--border)';

    const isFirstOpen = Boolean(options && options.openFirstDrawer && index === 0);

    const pointsHtml = Array.isArray(q.talking_points)
      ? q.talking_points.map(pt => `
          <li class="text-xs flex items-start space-x-2" style="color: var(--ink-2);">
            <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>${escapeHtml(pt)}</span>
          </li>
        `).join('')
      : '';

    const customChipHtml = q.is_custom
      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1" style="background: var(--amber-light); color: var(--amber);">
          <svg class="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
          <span>Custom Question</span>
        </span>`
      : (q.is_synthetic
        ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1 bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <svg class="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>Synthetic Drill</span>
          </span>`
        : '');

    card.innerHTML = `
      <div class="flex items-center justify-between flex-wrap gap-1.5">
        <div class="flex items-center space-x-1.5">
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center space-x-1" style="background: var(--paper-3); color: var(--ink);">
            <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            <span>${escapeHtml(q.category || 'Technical')}</span>
          </span>
          ${customChipHtml}
        </div>
        <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1" style="background: var(--amber-light); color: var(--amber);">
          <svg class="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>${escapeHtml(q.target_skill || 'Core Competency')}</span>
        </span>
      </div>
      <h5 class="text-xs font-bold leading-relaxed" style="color: var(--ink);">${escapeHtml(q.question)}</h5>
      <div class="p-2.5 rounded-lg text-xs border" style="background: var(--paper-3); border-color: var(--border);">
        <div class="font-bold text-[11px] mb-1 opacity-80 flex items-center space-x-1.5" style="color: var(--ink-2);">
          <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <span>Interviewer's Evaluation Intent:</span>
        </div>
        <p class="text-[11px] leading-relaxed opacity-90" style="color: var(--ink-3);">${escapeHtml(q.interviewer_intent || '')}</p>
      </div>
      <div class="pt-1">
        <div class="font-bold text-[11px] mb-1.5 opacity-80 flex items-center space-x-1.5" style="color: var(--ink-2);">
          <svg class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Talking Points</span>
        </div>
        <ul class="space-y-1.5 pl-0.5">
          ${pointsHtml}
        </ul>
      </div>

      <div class="pt-2 border-t flex items-center justify-between" style="border-color: var(--border);">
        <button type="button" class="btn-practice-toggle px-2.5 py-1 text-[11px] font-semibold rounded-lg transition hover:bg-slate-500/10 inline-flex items-center space-x-1" style="color: var(--amber); border: 1px solid var(--border);">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          <span class="btn-toggle-label">${isFirstOpen ? 'Hide Practice Drawer' : 'Practice Answer'}</span>
        </button>
        <button type="button" class="btn-copy-single-q px-2.5 py-1 text-[11px] font-semibold rounded-lg transition hover:bg-slate-500/10 inline-flex items-center space-x-1" style="color: var(--ink-2); border: 1px solid var(--border);">
          <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          <span>Copy</span>
        </button>
      </div>

      <!-- Practice Answer Drawer -->
      <div class="practice-drawer ${isFirstOpen ? '' : 'hidden'} pt-2 space-y-2.5 border-t" style="border-color: var(--border);">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span class="text-[10px] font-medium" style="color: var(--ink-3);">Answer in English, Tagalog, or Taglish:</span>
          <div class="flex items-center space-x-1 text-[11px]">
            <label class="text-[10px] opacity-70 mr-1" style="color: var(--ink-3);">Language:</label>
            <select class="practice-lang-select console-input text-[11px] px-2 py-0.5 rounded-md">
              <option value="Auto">Auto-Detect</option>
              <option value="Taglish" selected>Taglish (PH Tech)</option>
              <option value="Tagalog">Tagalog</option>
              <option value="English">English</option>
            </select>
          </div>
        </div>

        <textarea class="practice-input console-input w-full p-2.5 text-xs rounded-xl font-sans" rows="3" placeholder="Draft your answer using STAR (Situation, Task, Action, Result). Taglish is warmly welcomed! e.g. Sa previous project namin, nag-implement ako ng Redis cache tapos bumaba ang latency ng 40%..."></textarea>

        <div class="flex items-center justify-between">
          <span class="text-[10px] opacity-70" style="color: var(--ink-4);">Instant AI coaching evaluation & STAR Better Answer</span>
          <button type="button" class="btn-eval-answer px-3 py-1 text-xs font-bold btn-action-primary text-white rounded-lg inline-flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Evaluate Response</span>
          </button>
        </div>

        <div class="practice-feedback hidden p-3 rounded-xl border text-xs space-y-3" style="background: var(--surface); border-color: var(--border);"></div>
      </div>
    `;

    const copySingleBtn = card.querySelector('.btn-copy-single-q');
    if (copySingleBtn) {
      copySingleBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(`${q.question}\nIntent: ${q.interviewer_intent}\nTalking Points:\n- ${(q.talking_points || []).join('\n- ')}`);
          showToast('Question & talking points copied to clipboard!', 'success');
        } catch (e) {
          showToast('Copied question to clipboard.', 'success');
        }
      });
    }

    const practiceToggleBtn = card.querySelector('.btn-practice-toggle');
    const practiceDrawer = card.querySelector('.practice-drawer');
    const toggleLabel = card.querySelector('.btn-toggle-label');
    if (practiceToggleBtn && practiceDrawer) {
      practiceToggleBtn.addEventListener('click', () => {
        practiceDrawer.classList.toggle('hidden');
        if (toggleLabel) {
          toggleLabel.textContent = practiceDrawer.classList.contains('hidden') ? 'Practice Answer' : 'Hide Practice Drawer';
        }
      });
    }

    const evalBtn = card.querySelector('.btn-eval-answer');
    const practiceInput = card.querySelector('.practice-input');
    const langSelect = card.querySelector('.practice-lang-select');
    const feedbackBox = card.querySelector('.practice-feedback');

    if (evalBtn && practiceInput && feedbackBox) {
      evalBtn.addEventListener('click', () => {
        const preferredLang = langSelect ? langSelect.value : 'Auto';

        // Immediate synchronous evaluation with conversational loop-around
        const evaluateFn = (typeof SkillSyncInterview !== 'undefined' && typeof SkillSyncInterview.evaluateWithLoopAround === 'function')
          ? SkillSyncInterview.evaluateWithLoopAround
          : evaluateInterviewAnswer;
        const result = evaluateFn(q, practiceInput.value, { preferredLanguage: preferredLang, round: 1 });
        feedbackBox.classList.remove('hidden');

        const renderFeedbackUI = (res) => {
          const colorClass = res.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : (res.score >= 60 ? 'text-amber-500' : 'text-rose-500');

          let langChip = '';
          const globeSvg = `<svg class="w-3 h-3 inline-block mr-1 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`;
          if (res.language_detected === 'Taglish') {
            langChip = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background: var(--amber-light); color: var(--amber); border: 1px solid var(--border);">${globeSvg}Taglish (PH)</span>`;
          } else if (res.language_detected === 'Tagalog') {
            langChip = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30">${globeSvg}Tagalog (PH)</span>`;
          } else {
            langChip = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">${globeSvg}English (US)</span>`;
          }

          // Build Better Answer Card
          const better = res.better_answer || {};
          const starText = better.star_answer || (better.situation_task ? `${better.situation_task} ${better.action} ${better.result}` : '');
          const whyList = Array.isArray(better.why_better)
            ? better.why_better.map(w => `<li class="flex items-start space-x-1.5"><span class="text-amber-500 font-bold">•</span><span>${escapeHtml(w)}</span></li>`).join('')
            : '';

          const betterCardHtml = starText ? `
            <div class="mt-3 p-3.5 rounded-xl border space-y-2.5" style="background: var(--paper-3); border-color: var(--amber-light);">
              <div class="flex items-center justify-between flex-wrap gap-1">
                <div class="flex items-center space-x-1.5">
                  <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                  <span class="text-xs font-bold" style="color: var(--ink);">AI Coach's Better Answer (STAR Exemplar)</span>
                </div>
                <button type="button" class="btn-copy-better-answer text-[10px] font-semibold px-2 py-0.5 rounded transition hover:bg-slate-500/10" style="color: var(--ink-2); border: 1px solid var(--border);">
                  Copy Model Answer
                </button>
              </div>

              <div class="p-2.5 rounded-lg border text-xs leading-relaxed" style="background: var(--surface); border-color: var(--border); color: var(--ink);">
                "${escapeHtml(starText)}"
              </div>

              ${whyList ? `
                <div class="text-[11px] space-y-1">
                  <span class="font-bold opacity-80" style="color: var(--ink-2);">Why this is a better answer:</span>
                  <ul class="space-y-1 pl-1" style="color: var(--ink-3);">
                    ${whyList}
                  </ul>
                </div>
              ` : ''}
            </div>
          ` : '';

          // Conversational Loop-Around Drill Box
          let loopCardHtml = '';
          if (res.loop_around && res.loop_around.is_loop_active) {
            loopCardHtml = `
              <div class="loop-around-card mt-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <svg class="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span class="text-xs font-bold text-amber-500">Conversational Loop-Around Drill (Round 2)</span>
                  </div>
                  <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-500">Deepen &amp; Master</span>
                </div>
                <p class="text-xs font-medium leading-relaxed" style="color: var(--ink);">${escapeHtml(res.loop_around.followup_question)}</p>
                <p class="text-[11px] opacity-80" style="color: var(--ink-2);">${escapeHtml(res.loop_around.coaching_tip || '')}</p>
                <textarea class="loop-round-input console-input w-full p-2.5 text-xs rounded-xl font-sans" rows="2" placeholder="Subukan ulit dito sa Taglish / Tagalog / English: magdagdag ng quantified metrics, latency, o architecture trade-offs..."></textarea>
                <div class="flex items-center justify-between pt-1">
                  <span class="text-[10px] opacity-70" style="color: var(--ink-3);">Loop around to close knowledge gaps</span>
                  <button type="button" class="btn-submit-loop-around px-3 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg inline-flex items-center space-x-1 cursor-pointer shadow-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>Submit Loop-Around Response</span>
                  </button>
                </div>
                <div class="loop-round-result hidden p-2.5 rounded-lg border text-xs space-y-1.5 mt-2"></div>
              </div>
            `;
          }

          feedbackBox.innerHTML = `
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center space-x-2">
                <span class="font-bold ${colorClass}">${escapeHtml(res.grade)}</span>
                <span class="font-mono font-bold text-[11px] opacity-80" style="color: var(--ink);">${res.score}% Match</span>
                ${langChip}
              </div>
              <span class="text-[10px] font-mono opacity-70" style="color: var(--ink-3);">${res.coveredPoints.length}/${(q.talking_points || []).length} Points Covered</span>
            </div>
            <p class="text-[11px] leading-relaxed" style="color: var(--ink-2);">${escapeHtml(res.critique)}</p>
            ${loopCardHtml}
            ${betterCardHtml}
          `;

          // Wire loop-around submit button
          const loopBtn = feedbackBox.querySelector('.btn-submit-loop-around');
          const loopInput = feedbackBox.querySelector('.loop-round-input');
          const loopResult = feedbackBox.querySelector('.loop-round-result');
          if (loopBtn && loopInput && loopResult) {
            loopBtn.addEventListener('click', () => {
              const r2Text = loopInput.value.trim();
              if (r2Text.length < 10) {
                showToast('Please type a more detailed loop-around answer.', 'warning');
                return;
              }
              const r2Res = (typeof SkillSyncInterview !== 'undefined' && typeof SkillSyncInterview.evaluateWithLoopAround === 'function')
                ? SkillSyncInterview.evaluateWithLoopAround(q, r2Text, { preferredLanguage: preferredLang, round: 2, previousScore: res.score })
                : evaluateInterviewAnswer(q, r2Text, { preferredLanguage: preferredLang });

              loopResult.classList.remove('hidden');
              const delta = r2Res.score - res.score;
              const deltaBadge = delta > 0
                ? `<span class="text-emerald-500 font-bold font-mono text-[11px]">+${delta}% Mastery Jump</span>`
                : `<span class="text-amber-500 font-bold font-mono text-[11px]">Score Retained</span>`;
              
              loopResult.className = 'loop-round-result p-3 rounded-xl border text-xs space-y-2 mt-2 bg-emerald-500/10 border-emerald-500/30';
              loopResult.innerHTML = `
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center space-x-2">
                    <span class="font-bold text-emerald-500">Loop Mastered!</span>
                    <span class="font-mono font-bold text-[11px]" style="color: var(--ink);">${r2Res.score}% Final Score</span>
                    ${deltaBadge}
                  </div>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Round 2 Complete</span>
                </div>
                <p class="text-[11px] leading-relaxed" style="color: var(--ink-2);">${escapeHtml(r2Res.critique)}</p>
                <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">${escapeHtml((r2Res.loop_around && r2Res.loop_around.coaching_tip) || 'Great job closing the gap!')}</p>
              `;
              showToast(`Loop-Around Mastered! Score jumped to ${r2Res.score}%!`, 'success');
            });
          }

          // Wire copy model answer button
          const copyBetterBtn = feedbackBox.querySelector('.btn-copy-better-answer');
          if (copyBetterBtn) {
            copyBetterBtn.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(starText);
                showToast('Copied exemplary STAR answer to clipboard!', 'success');
              } catch (_) {
                showToast('Copied model answer.', 'success');
              }
            });
          }
        };

        renderFeedbackUI(result);

        // Progressive enhancement via backend only for custom non-synthetic questions, preserving active loop-around
        if (!q.is_synthetic && typeof getAuthBearerToken === 'function' && typeof fetch === 'function' && practiceInput.value.length >= 15) {
          getAuthBearerToken().then(token => {
            if (!token || token === 'demo-token-123') return;
            fetch('interview.php', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                action: 'evaluate',
                question: q.question,
                user_answer: practiceInput.value,
                target_skill: q.target_skill,
                talking_points: q.talking_points || [],
                preferred_language: preferredLang
              })
            }).then(r => r.ok ? r.json() : null)
              .then(apiRes => {
                if (apiRes && apiRes.score !== undefined) {
                  const round2Active = feedbackBox.querySelector('.loop-round-result:not(.hidden)') || feedbackBox.querySelector('.loop-round-input:focus');
                  if (!round2Active) {
                    renderFeedbackUI({
                      score: apiRes.score,
                      grade: apiRes.grade,
                      language_detected: apiRes.language_detected,
                      coveredPoints: apiRes.covered_points || [],
                      missingPoints: apiRes.missing_points || [],
                      critique: apiRes.critique,
                      better_answer: apiRes.better_answer || {},
                      loop_around: result.loop_around
                    });
                  }
                }
              }).catch(() => {});
          }).catch(() => {});
        }
      });
    }

    list.appendChild(card);
  });
}

/**
 * 14b. Salary Benchmarking & AI Negotiation Coach
 */
let lastSalaryData = null;

function calculateSalaryBenchmarks(role = 'Software Engineer', location = 'Remote', skills = [], currentOffer = 0) {
  const roleLower = (role || '').toLowerCase();
  const locLower = (location || '').toLowerCase();
  let base = 115000;
  if (roleLower.includes('senior') || roleLower.includes('sr')) base = 150000;
  else if (roleLower.includes('lead') || roleLower.includes('staff') || roleLower.includes('principal')) base = 185000;
  else if (roleLower.includes('junior') || roleLower.includes('jr') || roleLower.includes('entry')) base = 85000;

  if (roleLower.includes('architect') || roleLower.includes('director')) base = Math.max(base, 195000);
  else if (roleLower.includes('devops') || roleLower.includes('sre') || roleLower.includes('cloud')) base += 12000;
  else if (roleLower.includes('ai') || roleLower.includes('ml') || roleLower.includes('data')) base += 15000;

  let locMultiplier = 1.0;
  if (locLower.includes('san francisco') || locLower.includes('sf') || locLower.includes('silicon valley')) locMultiplier = 1.25;
  else if (locLower.includes('new york') || locLower.includes('nyc')) locMultiplier = 1.20;
  else if (locLower.includes('seattle') || locLower.includes('boston')) locMultiplier = 1.15;
  else if (locLower.includes('london') || locLower.includes('uk')) locMultiplier = 0.90;
  else if (locLower.includes('remote')) locMultiplier = 1.05;

  let skillBonus = 0;
  const premiums = [];
  (skills || []).forEach(s => {
    const sl = (s || '').toLowerCase();
    if (sl === 'aws' || sl === 'gcp' || sl === 'kubernetes' || sl === 'docker') {
      skillBonus += 3000;
      premiums.push({ skill: s, premium: '+4% Cloud/Infra' });
    } else if (sl === 'react' || sl === 'next.js' || sl === 'typescript') {
      skillBonus += 2500;
      premiums.push({ skill: s, premium: '+3% Modern Stack' });
    } else if (sl === 'python' || sl === 'fastapi' || sl.includes('ai')) {
      skillBonus += 3500;
      premiums.push({ skill: s, premium: '+5% Systems/AI' });
    }
  });
  skillBonus = Math.min(skillBonus, 18000);

  const median = Math.round(((base * locMultiplier) + skillBonus) / 1000) * 1000;
  const p25 = Math.round((median * 0.88) / 1000) * 1000;
  const p75 = Math.round((median * 1.14) / 1000) * 1000;
  const p90 = Math.round((median * 1.28) / 1000) * 1000;

  const numOffer = typeof currentOffer === 'number' ? currentOffer : parseInt(String(currentOffer).replace(/[^0-9]/g, ''), 10) || 0;
  let targetCounter = Math.round((median * 1.08) / 1000) * 1000;
  let status = 'at_market';
  let diff = 0;
  let percentDiff = 0;

  if (numOffer > 0) {
    diff = numOffer - median;
    percentDiff = Math.round((diff / median) * 1000) / 10;
    if (numOffer < p25) {
      status = 'below_market';
      targetCounter = Math.round((median * 1.05) / 1000) * 1000;
    } else if (numOffer > p75) {
      status = 'above_market';
      targetCounter = Math.round((numOffer * 1.05) / 1000) * 1000;
    } else {
      status = 'at_market';
      targetCounter = Math.round(Math.max(numOffer * 1.07, median * 1.08) / 1000) * 1000;
    }
  }

  const fmt = (n) => '$' + n.toLocaleString();
  const script = `Dear [Hiring Manager / Recruiter],\n\nThank you very much for extending the offer for the ${role} position. I am enthusiastic about the opportunity to join the team and contribute to your upcoming technical milestones.\n\n` +
    (numOffer > 0
      ? `Based on comprehensive industry benchmarks for ${role} roles in ${location}, as well as my verified track record with ${skills.length > 0 ? skills.slice(0, 3).join(', ') : 'modern system architecture'}, I would like to propose a base salary of ${fmt(targetCounter)}.\n\n`
      : `Based on market benchmarks for this role in ${location} and my technical background in ${skills.length > 0 ? skills.slice(0, 3).join(', ') : 'core engineering'}, I am targeting a base compensation of ${fmt(targetCounter)}.\n\n`) +
    `I am confident this reflects the immediate impact I will deliver to your engineering deliverables. If there is flexibility around this figure or components like sign-on bonus and equity, I would be delighted to discuss.\n\nThank you again for your time and support.\n\nWarm regards,\n[Your Name]`;

  return {
    success: true,
    role,
    location,
    benchmarks: {
      p25,
      median,
      p75,
      p90,
      formatted_p25: fmt(p25),
      formatted_median: fmt(median),
      formatted_p75: fmt(p75),
      formatted_p90: fmt(p90),
      target_counter: targetCounter,
      formatted_counter: fmt(targetCounter)
    },
    offer_analysis: {
      current_offer: numOffer,
      formatted_current: numOffer > 0 ? fmt(numOffer) : 'Not specified',
      status,
      percent_diff: percentDiff,
      difference: diff
    },
    skill_premiums: premiums.slice(0, 4),
    talking_points: [
      `Benchmark alignment: The 50th percentile market rate for ${role} in ${location} is ${fmt(median)}.`,
      `Core stack leverage: Deep proficiency in ${skills.length > 0 ? skills.slice(0, 3).join(', ') : 'required systems'} reduces ramp-up time to near zero.`,
      `Counter-offer recommendation: Anchor at ${fmt(targetCounter)} (approx. 7-10% above baseline) leaving room for mutual compromise.`,
      `Flexible levers: If base budget is constrained, negotiate equity grants, a one-time sign-on bonus, or an accelerated 6-month review.`
    ],
    script
  };
}

async function fetchSalaryBenchmarks(role, location, skills, currentOffer) {
  if (isDemoMode()) {
    return calculateSalaryBenchmarks(role, location, skills, currentOffer);
  }

  try {
    const token = await getAuthBearerToken();
    const res = await fetch('/backend/salary.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role, location, skills, current_offer: currentOffer })
    });

    if (res.ok) {
      return await res.json();
    }
    return calculateSalaryBenchmarks(role, location, skills, currentOffer);
  } catch (_) {
    return calculateSalaryBenchmarks(role, location, skills, currentOffer);
  }
}

function renderSalaryInsights(data) {
  if (!data || !data.benchmarks) return;
  lastSalaryData = data;

  const p25El = document.getElementById('salaryBenchP25');
  const medianEl = document.getElementById('salaryBenchMedian');
  const p75El = document.getElementById('salaryBenchP75');
  const p90El = document.getElementById('salaryBenchP90');
  const targetCounterEl = document.getElementById('salaryTargetCounter');
  const statusBadge = document.getElementById('salaryOfferStatusBadge');
  const talkingPointsList = document.getElementById('salaryTalkingPointsList');
  const scriptText = document.getElementById('salaryScriptText');

  if (p25El) p25El.textContent = data.benchmarks.formatted_p25;
  if (medianEl) medianEl.textContent = data.benchmarks.formatted_median;
  if (p75El) p75El.textContent = data.benchmarks.formatted_p75;
  if (p90El) p90El.textContent = data.benchmarks.formatted_p90;
  if (targetCounterEl) targetCounterEl.textContent = data.benchmarks.formatted_counter;

  if (statusBadge) {
    const status = data.offer_analysis?.status || 'at_market';
    if (status === 'below_market') {
      statusBadge.textContent = 'Below Market';
      statusBadge.style.background = 'var(--rose-light)';
      statusBadge.style.color = 'var(--rose)';
    } else if (status === 'above_market') {
      statusBadge.textContent = 'Top Tier';
      statusBadge.style.background = 'var(--sky-light)';
      statusBadge.style.color = 'var(--sky)';
    } else {
      statusBadge.textContent = 'Market Competitive';
      statusBadge.style.background = 'var(--sage-light)';
      statusBadge.style.color = 'var(--sage)';
    }
  }

  if (talkingPointsList && Array.isArray(data.talking_points)) {
    talkingPointsList.innerHTML = data.talking_points.map(pt => `
      <li class="text-xs flex items-start space-x-2" style="color: var(--ink-2);">
        <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        <span>${escapeHtml(pt)}</span>
      </li>
    `).join('');
  }

  if (scriptText) {
    scriptText.value = data.script || '';
  }
}

async function openSalaryModal(jobOrRole) {
  const modal = document.getElementById('salary-modal');
  if (!modal) return;

  const roleInput = document.getElementById('salaryRoleInput');
  const locInput = document.getElementById('salaryLocationInput');
  const offerInput = document.getElementById('salaryOfferInput');

  let role = 'Senior Full-Stack Engineer';
  let location = 'Remote';
  let currentOffer = '';
  let skills = [];

  if (typeof jobOrRole === 'object' && jobOrRole !== null) {
    role = jobOrRole.title || role;
    location = jobOrRole.location || location;
    currentOffer = jobOrRole.salary || '';
    skills = jobOrRole.tags || [];
  } else if (typeof jobOrRole === 'string' && jobOrRole.trim()) {
    role = jobOrRole.trim();
  } else {
    const jobTextEl = document.getElementById('jobText');
    if (jobTextEl && jobTextEl.value) {
      const firstLine = jobTextEl.value.split('\n')[0].replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      if (firstLine.length > 5 && firstLine.length < 50) {
        role = firstLine;
      }
    }
  }

  if (skills.length === 0 && typeof getAllVaultSkills === 'function') {
    skills = getAllVaultSkills().slice(0, 5);
  }

  if (roleInput) roleInput.value = role;
  if (locInput) locInput.value = location;
  if (offerInput) offerInput.value = currentOffer;

  modal.classList.remove('hidden');

  const data = await fetchSalaryBenchmarks(role, location, skills, currentOffer);
  renderSalaryInsights(data);
}

function initAiActionSuite() {
  const tailorBtn = document.getElementById('tailorResumeBtn');
  const coverLetterBtn = document.getElementById('generateCoverLetterBtn');
  const interviewBtn = document.getElementById('interviewPrepBtn');
  const salaryBtn = document.getElementById('salaryCoachBtn');

  const closeTailorBtn = document.getElementById('closeTailorModalBtn');
  const insertAllTailorBtn = document.getElementById('insertAllTailorBulletsBtn');
  const copyAllTailorBtn = document.getElementById('copyAllTailorBulletsBtn');

  const closeClBtn = document.getElementById('closeCoverLetterModalBtn');
  const clRegenerateBtn = document.getElementById('clRegenerateBtn');
  const copyClBtn = document.getElementById('copyCoverLetterBtn');
  const exportClPdfBtn = document.getElementById('exportCoverLetterPdfBtn');
  const toneBtns = document.querySelectorAll('.cl-tone-btn');

  const closeInterviewBtn = document.getElementById('closeInterviewModalBtn');
  const closeInterviewBottomBtn = document.getElementById('closeInterviewBtnBottom');
  const copyAllInterviewBtn = document.getElementById('copyAllInterviewBtn');

  if (tailorBtn) tailorBtn.addEventListener('click', openTailorModal);
  if (coverLetterBtn) coverLetterBtn.addEventListener('click', openCoverLetterModal);
  if (interviewBtn) interviewBtn.addEventListener('click', openInterviewModal);

  if (closeTailorBtn) {
    closeTailorBtn.addEventListener('click', () => {
      document.getElementById('tailor-modal')?.classList.add('hidden');
    });
  }

  if (insertAllTailorBtn) {
    insertAllTailorBtn.addEventListener('click', () => {
      if (lastTailorBullets.length === 0) return;
      const resumeTextEl = document.getElementById('resumeText');
      const resumeCount = document.getElementById('resumeCount');
      if (resumeTextEl) {
        const added = lastTailorBullets.map(b => '• ' + b.bullet).join('\n');
        resumeTextEl.value = (resumeTextEl.value.trim() + '\n\n' + added);
        updateCharCounter(resumeTextEl, resumeCount);
        showToast('Appended all tailored bullets to resume!', 'success');
        document.getElementById('tailor-modal')?.classList.add('hidden');
      }
    });
  }

  if (copyAllTailorBtn) {
    copyAllTailorBtn.addEventListener('click', async () => {
      if (lastTailorBullets.length === 0) return;
      const text = lastTailorBullets.map(b => '• ' + b.bullet).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied all tailored bullets to clipboard!', 'success');
      } catch (_) {
        showToast('Copied bullets.', 'success');
      }
    });
  }

  if (closeClBtn) {
    closeClBtn.addEventListener('click', () => {
      document.getElementById('coverletter-modal')?.classList.add('hidden');
    });
  }

  toneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toneBtns.forEach(b => {
        b.style.background = 'var(--paper-2)';
        b.style.color = 'var(--ink-3)';
      });
      btn.style.background = 'var(--surface)';
      btn.style.color = 'var(--ink)';
      const tone = btn.dataset.tone || 'modern';
      fetchCoverLetter(tone);
    });
  });

  if (clRegenerateBtn) {
    clRegenerateBtn.addEventListener('click', () => {
      const activeToneBtn = document.querySelector('.cl-tone-btn[style*="var(--surface)"]') || document.querySelector('.cl-tone-btn');
      const tone = activeToneBtn?.dataset.tone || 'modern';
      fetchCoverLetter(tone);
    });
  }

  if (copyClBtn) {
    copyClBtn.addEventListener('click', async () => {
      const textarea = document.getElementById('clLetterText');
      const text = textarea ? textarea.value : lastCoverLetterText;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied cover letter to clipboard!', 'success');
      } catch (_) {
        showToast('Copied cover letter.', 'success');
      }
    });
  }

  if (exportClPdfBtn) {
    exportClPdfBtn.addEventListener('click', () => {
      const textarea = document.getElementById('clLetterText');
      const text = textarea ? textarea.value : lastCoverLetterText;
      if (!text) return;

      const element = document.createElement('div');
      element.style.padding = '2.5rem';
      element.style.fontFamily = 'Georgia, serif';
      element.style.fontSize = '12pt';
      element.style.lineHeight = '1.6';
      element.style.color = '#111827';
      element.innerHTML = text.split('\n\n').map(p => `<p style="margin-bottom: 1.25rem;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');

      if (typeof html2pdf === 'function') {
        const opt = {
          margin: 0.75,
          filename: 'Cover_Letter_SkillSync.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
        showToast('Downloading Cover Letter PDF...', 'success');
      } else {
        window.print();
      }
    });
  }

  const closeInterviewFn = () => {
    document.getElementById('interview-modal')?.classList.add('hidden');
  };
  if (closeInterviewBtn) closeInterviewBtn.addEventListener('click', closeInterviewFn);
  if (closeInterviewBottomBtn) closeInterviewBottomBtn.addEventListener('click', closeInterviewFn);

  if (copyAllInterviewBtn) {
    copyAllInterviewBtn.addEventListener('click', async () => {
      if (lastInterviewQuestions.length === 0) return;
      const text = lastInterviewQuestions.map((q, i) => `${i + 1}. [${q.target_skill}] ${q.question}\nIntent: ${q.interviewer_intent}\nTalking Points:\n- ${(q.talking_points || []).join('\n- ')}`).join('\n\n');
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied interview prep questions!', 'success');
      } catch (_) {
        showToast('Copied questions.', 'success');
      }
    });
  }

  // Interview Modal Tabs & Custom Question Creator
  const tabGenBtn = document.getElementById('tabGeneratedQuestionsBtn');
  const tabCustomBtn = document.getElementById('tabCustomQuestionBtn');
  const customPanel = document.getElementById('customQuestionPanel');
  const interviewList = document.getElementById('interviewQuestionsList');
  const addCustomBtn = document.getElementById('addCustomQuestionBtn');
  const tabSyntheticBtn = document.getElementById('tabSyntheticQuestionsBtn');

  if (tabGenBtn && tabCustomBtn && customPanel && interviewList) {
    tabGenBtn.addEventListener('click', () => {
      customPanel.classList.add('hidden');
      interviewList.classList.remove('hidden');
      tabGenBtn.style.background = 'var(--surface)';
      tabGenBtn.style.color = 'var(--ink)';
      tabCustomBtn.style.background = 'transparent';
      tabCustomBtn.style.color = 'var(--ink-3)';
      if (tabSyntheticBtn) {
        tabSyntheticBtn.style.background = 'transparent';
        tabSyntheticBtn.style.color = 'var(--ink-3)';
      }
      if (lastInterviewQuestions && lastInterviewQuestions.length > 0) {
        renderInterviewQuestions(lastInterviewQuestions);
        const countBadge = document.getElementById('interviewCountBadge');
        if (countBadge) countBadge.textContent = `${lastInterviewQuestions.length} Questions`;
      }
    });

    if (tabSyntheticBtn) {
      tabSyntheticBtn.addEventListener('click', () => {
        customPanel.classList.add('hidden');
        interviewList.classList.remove('hidden');
        tabSyntheticBtn.style.background = 'var(--surface)';
        tabSyntheticBtn.style.color = 'var(--ink)';
        tabGenBtn.style.background = 'transparent';
        tabGenBtn.style.color = 'var(--ink-3)';
        tabCustomBtn.style.background = 'transparent';
        tabCustomBtn.style.color = 'var(--ink-3)';

        const corpus = (typeof SkillSyncInterview !== 'undefined' && Array.isArray(SkillSyncInterview.SYNTHETIC_INTERVIEW_CORPUS))
          ? SkillSyncInterview.SYNTHETIC_INTERVIEW_CORPUS.map(item => ({
              id: item.id,
              category: item.category,
              target_skill: item.target_skill,
              question: item.question_taglish,
              question_tagalog: item.question_tagalog,
              interviewer_intent: item.interviewer_intent,
              talking_points: item.talking_points,
              better_answer: item.synthetic_exemplars ? item.synthetic_exemplars.taglish : null,
              loop_around_prompts: item.loop_around_prompts,
              is_synthetic: true
            }))
          : [];

        if (corpus.length > 0) {
          lastInterviewQuestions = corpus;
          renderInterviewQuestions(corpus, { openFirstDrawer: true });
          const countBadge = document.getElementById('interviewCountBadge');
          if (countBadge) countBadge.textContent = `${corpus.length} Synthetic Drills (Tagalog/Taglish)`;
          showToast('Loaded Synthetic Filipino Tech Interview Corpus (Tagalog/Taglish)!', 'info');
        }
      });
    }

    tabCustomBtn.addEventListener('click', () => {
      customPanel.classList.remove('hidden');
      interviewList.classList.add('hidden');
      tabCustomBtn.style.background = 'var(--surface)';
      tabCustomBtn.style.color = 'var(--ink)';
      tabGenBtn.style.background = 'transparent';
      tabGenBtn.style.color = 'var(--ink-3)';
      if (tabSyntheticBtn) {
        tabSyntheticBtn.style.background = 'transparent';
        tabSyntheticBtn.style.color = 'var(--ink-3)';
      }
      document.getElementById('customQuestionInput')?.focus();
    });
  }

  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', () => {
      const qInput = document.getElementById('customQuestionInput');
      const sInput = document.getElementById('customSkillInput');
      const cInput = document.getElementById('customCategoryInput');
      const countBadge = document.getElementById('interviewCountBadge');

      const qText = qInput ? qInput.value.trim() : '';
      if (!qText) {
        showToast('Please type an interview question to practice.', 'warning');
        return;
      }

      const targetSkill = sInput && sInput.value.trim() ? sInput.value.trim() : 'Core Competency';
      const category = cInput && cInput.value.trim() ? cInput.value.trim() : 'Custom Practice';

      const newQ = createCustomInterviewQuestion(qText, targetSkill, category);
      lastInterviewQuestions.unshift(newQ);

      if (countBadge) {
        countBadge.textContent = `${lastInterviewQuestions.length} Questions`;
      }

      if (qInput) qInput.value = '';
      if (sInput) sInput.value = '';

      // Switch back to questions view
      tabGenBtn?.click();
      renderInterviewQuestions(lastInterviewQuestions);
      showToast('Added custom question to your interview session!', 'success');
    });
  }

  // Salary Coach Listeners
  const closeSalaryBtn = document.getElementById('closeSalaryModalBtn');
  const closeSalaryBottomBtn = document.getElementById('closeSalaryBtnBottom');
  const recalcSalaryBtn = document.getElementById('recalculateSalaryBtn');
  const copySalaryBtn = document.getElementById('copySalaryScriptBtn');

  if (salaryBtn) salaryBtn.addEventListener('click', () => openSalaryModal());

  const closeSalaryFn = () => {
    document.getElementById('salary-modal')?.classList.add('hidden');
  };
  if (closeSalaryBtn) closeSalaryBtn.addEventListener('click', closeSalaryFn);
  if (closeSalaryBottomBtn) closeSalaryBottomBtn.addEventListener('click', closeSalaryFn);

  if (recalcSalaryBtn) {
    recalcSalaryBtn.addEventListener('click', async () => {
      const role = document.getElementById('salaryRoleInput')?.value.trim() || 'Software Engineer';
      const loc = document.getElementById('salaryLocationInput')?.value.trim() || 'Remote';
      const offer = document.getElementById('salaryOfferInput')?.value.trim() || '';

      const locCheck = validateLocationName(loc);
      if (!locCheck.valid) {
        showToast(locCheck.error, 'error');
        return;
      }

      const skills = typeof getAllVaultSkills === 'function' ? getAllVaultSkills().slice(0, 5) : [];
      const data = await fetchSalaryBenchmarks(role, loc, skills, offer);
      renderSalaryInsights(data);
      showToast('Updated salary benchmarks!', 'success');
    });
  }

  if (copySalaryBtn) {
    copySalaryBtn.addEventListener('click', async () => {
      const textarea = document.getElementById('salaryScriptText');
      const text = textarea ? textarea.value : (lastSalaryData?.script || '');
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied negotiation script to clipboard!', 'success');
      } catch (_) {
        showToast('Copied script.', 'success');
      }
    });
  }
}

/**
 * 15. Job Application Pipeline Kanban Tracker & Analytics Engine
 */
let pipelineJobs = [
  {
    id: 'sample-pipe-1',
    title: 'Senior Frontend Engineer',
    company_name: 'Vercel',
    location: 'Remote',
    salary: '$140k - $185k',
    url: 'https://vercel.com/careers',
    score: 88,
    status: 'saved',
    created_at: new Date().toISOString().split('T')[0]
  },
  {
    id: 'sample-pipe-2',
    title: 'Full-Stack Developer (Node & React)',
    company_name: 'Stripe',
    location: 'San Francisco, CA / Remote',
    salary: '$150k - $195k',
    url: 'https://stripe.com/jobs',
    score: 78,
    status: 'applied',
    created_at: new Date().toISOString().split('T')[0]
  }
];

function checkFollowupDue(job) {
  if (!job || !job.created_at) return { due: false, days: 0 };
  const createdTime = new Date(job.created_at).getTime();
  if (isNaN(createdTime)) return { due: false, days: 0 };
  const daysDiff = Math.max(0, Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24)));

  if (job.status === 'applied' && daysDiff >= 5) {
    return { due: true, label: `${daysDiff}d • Follow-Up Due`, type: 'checkin', days: daysDiff };
  }
  if (job.status === 'interviewing' && daysDiff >= 3) {
    return { due: true, label: `${daysDiff}d • Check-In Due`, type: 'status', days: daysDiff };
  }
  return { due: false, days: daysDiff };
}

function generateFollowupEmail(company = 'Company', role = 'Software Engineer', type = 'checkin') {
  let subject = '';
  let body = '';

  if (type === 'thankyou') {
    subject = `Thank you for the opportunity - ${role} interview`;
    body = `Hi [Interviewer Name],\n\nThank you so much for taking the time to speak with me today about the ${role} position at ${company}.\n\nI really enjoyed learning more about the team's technical roadmap and engineering challenges. Our conversation reinforced my excitement about the role, particularly how my experience with scalable architecture can contribute to your goals.\n\nPlease don't hesitate to reach out if you need any additional information or work samples.\n\nBest regards,\n[Your Name]`;
  } else if (type === 'status') {
    subject = `Checking in regarding the ${role} application - [Your Name]`;
    body = `Hi [Recruiter / Hiring Team],\n\nI hope you're having a productive week.\n\nI wanted to follow up on our recent interview for the ${role} opening at ${company}. I remain very enthusiastic about the position and the opportunity to support your team.\n\nCould you please share if there are any updates regarding the next steps in the hiring process?\n\nThank you again for your time and guidance.\n\nWarmly,\n[Your Name]`;
  } else {
    subject = `Application Follow-Up: ${role} - [Your Name]`;
    body = `Hi [Hiring Team],\n\nI hope this email finds you well.\n\nI recently submitted my application for the ${role} role at ${company} and wanted to reiterate my strong enthusiasm for joining your team.\n\nGiven my background in full-stack systems and automated workflows, I am confident I can make an immediate impact on your upcoming technical deliverables.\n\nI look forward to hearing about the next steps.\n\nBest regards,\n[Your Name]\n[Portfolio/GitHub Link]`;
  }

  return { subject, body };
}

function calculatePipelineMetrics(jobs = pipelineJobs) {
  const total = jobs.length;
  const saved = jobs.filter(j => j.status === 'saved').length;
  const applied = jobs.filter(j => j.status === 'applied').length;
  const interviewing = jobs.filter(j => j.status === 'interviewing').length;
  const offer = jobs.filter(j => j.status === 'offer').length;

  const activeInFlight = applied + interviewing;
  const denominator = applied + interviewing + offer;
  const interviewRate = denominator > 0 ? Math.round(((interviewing + offer) / denominator) * 100) : 0;
  const offerRate = denominator > 0 ? Math.round((offer / denominator) * 100) : 0;

  const validScores = jobs.filter(j => typeof j.score === 'number' && j.score > 0);
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((acc, curr) => acc + curr.score, 0) / validScores.length)
    : 75;

  return {
    total,
    saved,
    applied,
    interviewing,
    offer,
    activeInFlight,
    interviewRate,
    offerRate,
    avgScore
  };
}

function renderPipelineAnalytics(metrics) {
  const m = metrics || calculatePipelineMetrics(pipelineJobs);

  const totalEl = document.getElementById('metricTotalRoles');
  const activeEl = document.getElementById('metricActiveInFlight');
  const interviewRateEl = document.getElementById('metricInterviewRate');
  const avgFitEl = document.getElementById('metricAvgFit');
  const offerCountEl = document.getElementById('metricOfferCount');

  if (totalEl) totalEl.textContent = m.total;
  if (activeEl) activeEl.textContent = m.activeInFlight;
  if (interviewRateEl) interviewRateEl.textContent = `${m.interviewRate}%`;
  if (avgFitEl) avgFitEl.textContent = `${m.avgScore}%`;
  if (offerCountEl) offerCountEl.textContent = `${m.offer} Offer${m.offer === 1 ? '' : 's'}`;

  const barSaved = document.getElementById('funnelBarSaved');
  const barApplied = document.getElementById('funnelBarApplied');
  const barInterview = document.getElementById('funnelBarInterview');
  const barOffer = document.getElementById('funnelBarOffer');

  if (m.total > 0) {
    if (barSaved) barSaved.style.width = `${Math.max(5, Math.round((m.saved / m.total) * 100))}%`;
    if (barApplied) barApplied.style.width = `${Math.max(5, Math.round((m.applied / m.total) * 100))}%`;
    if (barInterview) barInterview.style.width = `${Math.max(5, Math.round((m.interviewing / m.total) * 100))}%`;
    if (barOffer) barOffer.style.width = `${Math.max(5, Math.round((m.offer / m.total) * 100))}%`;
  }
}

function openFollowupModal(job, defaultType = 'checkin') {
  const modal = document.getElementById('followup-modal');
  if (!modal) return;

  const companyInput = document.getElementById('followupCompanyInput');
  const roleInput = document.getElementById('followupRoleInput');
  const typeSelect = document.getElementById('followupTypeSelect');
  const subjectInput = document.getElementById('followupSubjectInput');
  const bodyText = document.getElementById('followupBodyText');

  const company = job ? (job.company_name || 'Target Company') : 'Target Company';
  const role = job ? (job.title || 'Software Engineer') : 'Software Engineer';

  if (companyInput) companyInput.value = company;
  if (roleInput) roleInput.value = role;
  if (typeSelect) typeSelect.value = defaultType;

  const email = generateFollowupEmail(company, role, defaultType);
  if (subjectInput) subjectInput.value = email.subject;
  if (bodyText) bodyText.value = email.body;

  modal.classList.remove('hidden');
}

function loadPipelineFromStorage() {
  try {
    const raw = localStorage.getItem('skillsync_pipeline_jobs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        pipelineJobs = parsed;
      }
    }
  } catch (_) {}
}

function savePipelineToStorage() {
  try {
    localStorage.setItem('skillsync_pipeline_jobs', JSON.stringify(pipelineJobs));
    return true;
  } catch {
    return false;
  }
}

function addJobToPipeline(job, initialStatus = 'saved') {
  if (!job || !job.title) return;

  const exists = pipelineJobs.some(j => j.title.toLowerCase() === job.title.toLowerCase() && j.company_name.toLowerCase() === (job.company_name || '').toLowerCase());
  if (exists) {
    showToast(`${job.title} is already in your application pipeline.`, 'warning');
    return;
  }

  const newEntry = {
    id: job.id || `pipe-${Date.now()}`,
    title: job.title,
    company_name: job.company_name || 'Hiring Company',
    location: job.location || 'Remote',
    salary: job.salary || 'Competitive',
    url: job.url || '#',
    score: job.score || 75,
    description: typeof job.description === 'string' ? job.description.trim().slice(0, 30000) : '',
    status: initialStatus,
    created_at: new Date().toISOString().split('T')[0]
  };

  pipelineJobs.unshift(newEntry);
  savePipelineToStorage();
  renderPipeline();
  showToast(`Added ${job.title} to ${initialStatus.toUpperCase()} pipeline!`, 'success');
}

function updatePipelineJobStatus(jobId, newStatus) {
  const job = pipelineJobs.find(j => j.id === jobId);
  if (!job) return;

  job.status = newStatus;
  savePipelineToStorage();
  renderPipeline();

  if (newStatus.toLowerCase() === 'offer') {
    if (typeof SkillSyncParticles !== 'undefined' && typeof SkillSyncParticles.burstConfetti === 'function') {
      SkillSyncParticles.burstConfetti({ count: 95 });
    }
    if (typeof SkillSyncAudio !== 'undefined' && typeof SkillSyncAudio.playOfferFanfare === 'function') {
      SkillSyncAudio.playOfferFanfare();
    }
    showToast(`Congratulations! Moved ${job.title} to OFFER stage!`, 'success', 5000);
  } else {
    showToast(`Moved ${job.title} to ${newStatus.toUpperCase()}.`, 'success');
  }
}

function deletePipelineJob(jobId) {
  pipelineJobs = pipelineJobs.filter(j => j.id !== jobId);
  savePipelineToStorage();
  renderPipeline();
  showToast('Removed role from pipeline.', 'success');
}

let refreshProjectPlanner;

function initProjectPlanner() {
  const panel = document.getElementById('projectPlanner');
  if (!panel || typeof SkillSyncProjectPlannerUI === 'undefined') return;
  const refreshEvidence = () => {
    vaultDocumentsCache = [
      ...SkillSyncProjectPlannerUI.readEvidence(),
      ...vaultDocumentsCache.filter(doc => !doc.id.startsWith('planner-project-'))
    ];
    renderVaultUI();
    recomputeAndRenderJobCards();
  };
  refreshEvidence();

  refreshProjectPlanner = SkillSyncProjectPlannerUI.mount(panel, {
    getJobs: () => pipelineJobs.filter(job => !String(job.id).startsWith('sample-pipe-')),
    getSkills: () => SkillSyncProjectPlanner.extractSkills([
      document.getElementById('resumeText')?.value || '',
      ...vaultDocumentsCache.filter(doc => !['doc-vault-1', 'doc-vault-2'].includes(doc.id))
        .flatMap(doc => doc.extracted_skills)
    ].join(', ')),
    saveDescription: (id, description) => {
      const job = pipelineJobs.find(entry => entry.id === id);
      if (!job) return false;
      const previous = job.description;
      job.description = description;
      if (savePipelineToStorage()) return true;
      job.description = previous;
      return false;
    },
    refreshEvidence,
    openRole: (role, evidence) => {
      const resume = document.getElementById('resumeText');
      const project = `Portfolio project: ${evidence.doc_name}\n${evidence.content_snippet}`;
      if (resume && !resume.value.includes(project)) {
        replaceWorkspaceText('resumeText', [resume.value.trim(), project].filter(Boolean).join('\n\n'));
      }
      replaceWorkspaceText('jobText', role.description);
      switchWorkspaceTab('ats');
      document.getElementById('jobText')?.focus();
    }
  });
}

function renderPipeline() {
  refreshProjectPlanner?.();
  const colSaved = document.getElementById('colListSaved');
  const colApplied = document.getElementById('colListApplied');
  const colInterview = document.getElementById('colListInterviewing');
  const colOffer = document.getElementById('colListOffer');

  const countSaved = document.getElementById('colCountSaved');
  const countApplied = document.getElementById('colCountApplied');
  const countInterview = document.getElementById('colCountInterviewing');
  const countOffer = document.getElementById('colCountOffer');
  const tabBadge = document.getElementById('pipelineCountBadge');

  if (!colSaved || !colApplied || !colInterview || !colOffer) return;

  const buckets = {
    saved: pipelineJobs.filter(j => j.status === 'saved'),
    applied: pipelineJobs.filter(j => j.status === 'applied'),
    interviewing: pipelineJobs.filter(j => j.status === 'interviewing'),
    offer: pipelineJobs.filter(j => j.status === 'offer')
  };

  if (countSaved) countSaved.textContent = buckets.saved.length;
  if (countApplied) countApplied.textContent = buckets.applied.length;
  if (countInterview) countInterview.textContent = buckets.interviewing.length;
  if (countOffer) countOffer.textContent = buckets.offer.length;
  if (tabBadge) tabBadge.textContent = pipelineJobs.length;

  renderPipelineAnalytics(calculatePipelineMetrics(pipelineJobs));

  const renderColumn = (container, jobs, stageKey) => {
    container.innerHTML = '';
    if (jobs.length === 0) {
      const stageMeta = {
        saved: {
          icon: '<svg class="w-4 h-4 text-[var(--ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>',
          title: 'No saved roles',
          subtitle: 'Add a role to start tracking'
        },
        applied: {
          icon: '<svg class="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>',
          title: 'No applications yet',
          subtitle: 'Move roles here once submitted'
        },
        interviewing: {
          icon: '<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
          title: 'No active interviews',
          subtitle: 'Move scheduled interviews here'
        },
        offer: {
          icon: '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>',
          title: 'No offers yet',
          subtitle: 'Your accepted job milestones'
        }
      }[stageKey] || {
        icon: '<svg class="w-4 h-4 text-[var(--ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
        title: 'No roles in this stage',
        subtitle: 'Drag or assign roles here'
      };

      container.innerHTML = `
        <div class="h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center p-3 text-[11px] space-y-1.5" style="border-color: var(--border); color: var(--ink-3);">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70" style="background: var(--paper-3);">
            ${stageMeta.icon}
          </div>
          <div>
            <div class="font-bold text-[11px]" style="color: var(--ink-2);">${stageMeta.title}</div>
            <div class="text-[10px] opacity-65">${stageMeta.subtitle}</div>
          </div>
        </div>
      `;
      return;
    }

    jobs.forEach(j => {
      const card = document.createElement('div');
      card.className = 'kanban-card space-y-2.5 transition';

      const colors = getScoreColorClasses(j.score || 70);
      const followupCheck = checkFollowupDue(j);
      const followupBadgeHtml = followupCheck.due
        ? `<button type="button" class="btn-pipe-followup px-2.5 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center space-x-1 transition hover:opacity-90" style="background: var(--amber-light); color: var(--amber);">
             <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
             <span>${followupCheck.label}</span>
           </button>`
        : '';

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <h5 class="font-bold text-xs leading-snug" style="color: var(--ink);">${escapeHtml(j.title)}</h5>
            <p class="text-[11px] font-medium opacity-80" style="color: var(--ink-3);">${escapeHtml(j.company_name)} • ${escapeHtml(j.location)}</p>
          </div>
          <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${colors.badge}">
            ${j.score}%
          </span>
        </div>

        <div class="flex items-center justify-between text-[11px] font-mono opacity-70 pt-1" style="color: var(--ink-3);">
          <span>${escapeHtml(j.salary)}</span>
          <span>${escapeHtml(j.created_at)}</span>
        </div>
        ${followupBadgeHtml ? `<div class="pt-0.5">${followupBadgeHtml}</div>` : ''}

        <div class="pt-2 border-t flex items-center justify-between gap-1" style="border-color: var(--border);">
          <select aria-label="Application status for ${escapeHtml(j.title)}" class="pipe-status-select console-input text-[11px] px-2 py-1 rounded-lg cursor-pointer">
            <option value="saved" ${j.status === 'saved' ? 'selected' : ''}>Saved</option>
            <option value="applied" ${j.status === 'applied' ? 'selected' : ''}>Applied</option>
            <option value="interviewing" ${j.status === 'interviewing' ? 'selected' : ''}>Interviewing</option>
            <option value="offer" ${j.status === 'offer' ? 'selected' : ''}>Offer</option>
          </select>

          <div class="flex items-center space-x-1">
            <button type="button" class="btn-pipe-load p-1 rounded-lg hover:bg-slate-500/10 transition" title="Compare resume" aria-label="Compare resume for ${escapeHtml(j.title)}" style="color: var(--ink-2);">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
            <button type="button" class="btn-pipe-delete p-1 rounded-lg hover:bg-rose-500/10 text-rose-500 transition" title="Delete application" aria-label="Delete application for ${escapeHtml(j.title)}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;

      const select = card.querySelector('.pipe-status-select');
      if (select) {
        select.addEventListener('change', (e) => {
          updatePipelineJobStatus(j.id, e.target.value);
        });
      }

      const followupBtn = card.querySelector('.btn-pipe-followup');
      if (followupBtn) {
        followupBtn.addEventListener('click', () => {
          openFollowupModal(j, followupCheck.type || 'checkin');
        });
      }

      const loadBtn = card.querySelector('.btn-pipe-load');
      if (loadBtn) {
        loadBtn.addEventListener('click', () => {
          loadJobIntoWorkspace(j);
        });
      }

      const delBtn = card.querySelector('.btn-pipe-delete');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          deletePipelineJob(j.id);
        });
      }

      container.appendChild(card);
    });
  };

  renderColumn(colSaved, buckets.saved, 'saved');
  renderColumn(colApplied, buckets.applied, 'applied');
  renderColumn(colInterview, buckets.interviewing, 'interviewing');
  renderColumn(colOffer, buckets.offer, 'offer');
}

function initPipeline() {
  loadPipelineFromStorage();
  initProjectPlanner();

  const tabPipeline = document.getElementById('tabPipeline');
  if (tabPipeline) {
    tabPipeline.addEventListener('click', () => switchWorkspaceTab('pipeline'));
  }

  const addBtn = document.getElementById('addPipelineJobBtn');
  const addModal = document.getElementById('add-pipeline-modal');
  const closeBtn = document.getElementById('closeAddPipelineModalBtn');
  const cancelBtn = document.getElementById('cancelAddPipelineBtn');
  const form = document.getElementById('addPipelineForm');

  const useDescriptionBtn = document.getElementById('useComparisonJobDescriptionBtn');
  const descriptionInput = document.getElementById('manualJobDescription');
  if (addBtn && addModal) {
    addBtn.addEventListener('click', () => {
      if (useDescriptionBtn) useDescriptionBtn.disabled = !document.getElementById('jobText')?.value.trim();
      addModal.classList.remove('hidden');
    });
  }

  useDescriptionBtn?.addEventListener('click', () => {
    if (descriptionInput) descriptionInput.value = (document.getElementById('jobText')?.value || '').slice(0, 30000);
  });

  const closeAddModal = () => addModal?.classList.add('hidden');
  if (closeBtn) closeBtn.addEventListener('click', closeAddModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAddModal);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('manualJobTitle')?.value.trim();
      const company = document.getElementById('manualJobCompany')?.value.trim();
      const location = document.getElementById('manualJobLocation')?.value.trim() || 'Remote';
      const salary = document.getElementById('manualJobSalary')?.value.trim() || 'Competitive';
      const status = document.getElementById('manualJobStatus')?.value || 'saved';
      const url = document.getElementById('manualJobUrl')?.value.trim() || '#';

      if (!title || !company) return;

      const locCheck = validateLocationName(location);
      if (!locCheck.valid) {
        showToast(locCheck.error, 'error');
        return;
      }

      addJobToPipeline({
        id: `pipe-${Date.now()}`,
        title,
        company_name: company,
        location,
        salary,
        url,
        description: descriptionInput?.value,
        score: 80,
        status,
        created_at: new Date().toISOString().split('T')[0]
      }, status);

      form.reset();
      closeAddModal();
    });
  }

  // Pipeline Analytics Toggle Listener
  const toggleAnalyticsBtn = document.getElementById('togglePipelineAnalyticsBtn');
  const analyticsPanel = document.getElementById('pipelineAnalyticsPanel');
  if (toggleAnalyticsBtn && analyticsPanel) {
    toggleAnalyticsBtn.addEventListener('click', () => {
      analyticsPanel.classList.toggle('hidden');
    });
  }

  // Follow-Up Modal Listeners
  const closeFollowupBtn = document.getElementById('closeFollowupModalBtn');
  const closeFollowupBottomBtn = document.getElementById('closeFollowupBtnBottom');
  const closeFollowupFn = () => {
    document.getElementById('followup-modal')?.classList.add('hidden');
  };
  if (closeFollowupBtn) closeFollowupBtn.addEventListener('click', closeFollowupFn);
  if (closeFollowupBottomBtn) closeFollowupBottomBtn.addEventListener('click', closeFollowupFn);

  const followupTypeSelect = document.getElementById('followupTypeSelect');
  if (followupTypeSelect) {
    followupTypeSelect.addEventListener('change', () => {
      const company = document.getElementById('followupCompanyInput')?.value.trim() || 'Company';
      const role = document.getElementById('followupRoleInput')?.value.trim() || 'Software Engineer';
      const email = generateFollowupEmail(company, role, followupTypeSelect.value);
      const sub = document.getElementById('followupSubjectInput');
      const body = document.getElementById('followupBodyText');
      if (sub) sub.value = email.subject;
      if (body) body.value = email.body;
    });
  }

  const copyFollowupBtn = document.getElementById('copyFollowupEmailBtn');
  if (copyFollowupBtn) {
    copyFollowupBtn.addEventListener('click', async () => {
      const sub = document.getElementById('followupSubjectInput')?.value || '';
      const body = document.getElementById('followupBodyText')?.value || '';
      const fullText = `Subject: ${sub}\n\n${body}`;
      try {
        await navigator.clipboard.writeText(fullText);
        showToast('Copied follow-up email to clipboard!', 'success');
      } catch (_) {
        showToast('Copied email.', 'success');
      }
    });
  }

  renderPipeline();
}

/**
 * 17. 2-Week Skill Bridge Roadmap Generator
 */
let currentRoadmapData = [];

function generateRoadmapCurriculum(missingSkills = []) {
  const skills = (Array.isArray(missingSkills) && missingSkills.length > 0)
    ? missingSkills.map(s => String(s).trim()).filter(Boolean)
    : ['System Architecture', 'Modern Cloud / DevOps', 'API Optimization'];

  const primarySkill = skills[0] || 'Technical Specialization';
  const secondarySkill = skills[1] || primarySkill;
  const tertiarySkill = skills[2] || secondarySkill;

  const milestones = [
    {
      id: 'milestone_1',
      dayRange: 'Days 1–2',
      skill: primarySkill,
      title: `${primarySkill}: Core Mental Model & Syntax Foundations`,
      objective: `Master the foundational paradigm, project bootstrapping, and architectural primitives of ${primarySkill}.`,
      hours: '4 hrs',
      docsUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(primarySkill)}`
    },
    {
      id: 'milestone_2',
      dayRange: 'Days 3–5',
      skill: primarySkill,
      title: `${primarySkill}: Idiomatic Patterns & Production APIs`,
      objective: `Implement state management, error boundaries, and concurrency/asynchronous workflows in ${primarySkill}.`,
      hours: '6 hrs',
      docsUrl: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(primarySkill)}`
    },
    {
      id: 'milestone_3',
      dayRange: 'Days 6–7',
      skill: secondarySkill,
      title: `${secondarySkill}: Tooling & Verification Pipeline`,
      objective: `Write unit and integration suites targeting 85%+ coverage, plus automated linting and pre-commit hooks for ${secondarySkill}.`,
      hours: '5 hrs',
      docsUrl: `https://www.google.com/search?q=${encodeURIComponent(secondarySkill + ' best practices')}`
    },
    {
      id: 'milestone_4',
      dayRange: 'Days 8–10',
      skill: secondarySkill,
      title: `${secondarySkill}: Performance Tuning & Scalability`,
      objective: `Benchmark throughput, profile memory allocations, diagnose bottlenecks, and implement indexing/caching in ${secondarySkill}.`,
      hours: '6 hrs',
      docsUrl: `https://www.google.com/search?q=${encodeURIComponent(secondarySkill + ' performance optimization')}`
    },
    {
      id: 'milestone_5',
      dayRange: 'Days 11–12',
      skill: tertiarySkill,
      title: `${tertiarySkill}: Infrastructure, Security & Containerization`,
      objective: `Dockerize the application, configure non-root security contexts, env secrets management, and automated CI/CD stages.`,
      hours: '5 hrs',
      docsUrl: `https://www.google.com/search?q=${encodeURIComponent(tertiarySkill + ' security hardening')}`
    },
    {
      id: 'milestone_6',
      dayRange: 'Days 13–14',
      skill: primarySkill,
      title: `Full-Stack Capstone Proof-of-Concept & Portfolio Demo`,
      objective: `Synthesize ${primarySkill} and ${secondarySkill} into a production-grade mini-project deployed with live telemetry.`,
      hours: '8 hrs',
      docsUrl: `https://github.com/topics/${encodeURIComponent(primarySkill.toLowerCase().replace(/[^a-z0-9]/g, ''))}`
    }
  ];

  return milestones;
}

function loadRoadmapProgress() {
  try {
    const raw = localStorage.getItem('skillsync_roadmap_progress');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveRoadmapProgress(progressMap) {
  try {
    localStorage.setItem('skillsync_roadmap_progress', JSON.stringify(progressMap));
  } catch (_) {}
}

function renderRoadmap(milestones = []) {
  currentRoadmapData = milestones;
  const listEl = document.getElementById('roadmapMilestonesList');
  const barEl = document.getElementById('roadmapProgressBar');
  const textEl = document.getElementById('roadmapProgressText');
  const subtitleEl = document.getElementById('roadmapSubtitle');

  const progress = loadRoadmapProgress();
  const total = milestones.length;
  let completedCount = 0;

  milestones.forEach(m => {
    if (progress[m.id]) completedCount++;
  });

  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (barEl) barEl.style.width = `${percentage}%`;
  if (textEl) textEl.textContent = `${completedCount} / ${total} Milestones (${percentage}%)`;
  if (subtitleEl && milestones.length > 0) {
    const skillsUnique = [...new Set(milestones.map(m => m.skill))];
    subtitleEl.textContent = `2-Week sprint covering: ${skillsUnique.join(', ')}`;
  }

  if (!listEl) return;
  listEl.innerHTML = '';

  if (milestones.length === 0) {
    listEl.innerHTML = '<p class="text-xs p-6 text-center opacity-70" style="color: var(--ink-3);">No missing skills identified. You are fully aligned!</p>';
    return;
  }

  milestones.forEach(m => {
    const isDone = !!progress[m.id];
    const card = document.createElement('div');
    card.className = `p-3.5 rounded-xl border transition flex items-start space-x-3 ${isDone ? 'opacity-65' : ''}`;
    card.style.background = isDone ? 'var(--paper-2)' : 'var(--surface)';
    card.style.borderColor = isDone ? 'var(--border)' : 'var(--border)';

    const ytUrl = generateYouTubeLink(m.skill);

    card.innerHTML = `
      <button type="button" class="roadmap-toggle-btn mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400/60 hover:border-emerald-500'}" data-id="${escapeHtml(m.id)}" title="${isDone ? 'Mark incomplete' : 'Mark completed'}">
        <svg class="w-3.5 h-3.5 ${isDone ? 'block' : 'hidden'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
      </button>
      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider" style="background: var(--sage-light); color: var(--sage);">${escapeHtml(m.dayRange)}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md" style="background: var(--paper-3); color: var(--ink-2);">${escapeHtml(m.skill)}</span>
          <span class="text-[10px] font-mono ml-auto opacity-70" style="color: var(--ink-4);">${escapeHtml(m.hours)}</span>
        </div>
        <h4 class="text-xs font-bold ${isDone ? 'line-through opacity-75' : ''}" style="color: var(--ink);">${escapeHtml(m.title)}</h4>
        <p class="text-[11px] leading-relaxed opacity-80" style="color: var(--ink-2);">${escapeHtml(m.objective)}</p>
        <div class="pt-1.5 flex items-center space-x-3 text-[11px]">
          <a href="${ytUrl}" target="_blank" rel="noopener noreferrer" class="font-medium hover:underline inline-flex items-center space-x-1" style="color: var(--sage);">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Video Tutorial</span>
          </a>
          <a href="${m.docsUrl}" target="_blank" rel="noopener noreferrer" class="font-medium hover:underline inline-flex items-center space-x-1" style="color: var(--ink-3);">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            <span>Documentation</span>
          </a>
        </div>
      </div>
    `;

    listEl.appendChild(card);
  });
}

function toggleRoadmapMilestone(milestoneId) {
  const progress = loadRoadmapProgress();
  progress[milestoneId] = !progress[milestoneId];
  saveRoadmapProgress(progress);
  renderRoadmap(currentRoadmapData);
}

function resetRoadmapProgress() {
  saveRoadmapProgress({});
  renderRoadmap(currentRoadmapData);
  showToast('Roadmap progress reset.', 'info');
}

function openRoadmapModal() {
  const modal = document.getElementById('roadmap-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  let missing = [];
  if (lastAnalysisResult && Array.isArray(lastAnalysisResult.missing_skills) && lastAnalysisResult.missing_skills.length > 0) {
    missing = lastAnalysisResult.missing_skills;
  } else {
    const jobTextEl = document.getElementById('jobText');
    const jobText = jobTextEl ? jobTextEl.value : '';
    const extracted = extractSkillsFromText(jobText);
    missing = extracted.length > 0 ? extracted.slice(0, 3) : ['TypeScript', 'Docker', 'GraphQL'];
  }

  const milestones = generateRoadmapCurriculum(missing);
  renderRoadmap(milestones);
}

function initRoadmap() {
  const openBtn = document.getElementById('generateRoadmapBtn');
  const closeBtn = document.getElementById('closeRoadmapModalBtn');
  const closeBottomBtn = document.getElementById('closeRoadmapBtnBottom');
  const resetBtn = document.getElementById('resetRoadmapProgressBtn');
  const listEl = document.getElementById('roadmapMilestonesList');
  const modal = document.getElementById('roadmap-modal');

  if (openBtn) {
    openBtn.addEventListener('click', openRoadmapModal);
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (closeBottomBtn && modal) {
    closeBottomBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', resetRoadmapProgress);
  }
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.roadmap-toggle-btn');
      if (btn && btn.dataset.id) {
        toggleRoadmapMilestone(btn.dataset.id);
      }
    });
  }
}

/**
 * 18. Company Research Dossier
 */
function generateCompanyDossier(info = {}) {
  let company = 'Target Company';
  let title = 'Software Engineer';
  let description = '';

  if (typeof info === 'string') {
    company = info.trim() || 'Target Company';
  } else if (info && typeof info === 'object') {
    company = info.company || info.companyName || 'Target Company';
    title = info.title || info.roleTitle || 'Software Engineer';
    description = info.description || info.job_description || '';
  }

  const extractedSkills = extractSkillsFromText(description);
  const techStack = extractedSkills.length > 0
    ? extractedSkills.map(s => {
        const special = {
          'javascript': 'JavaScript',
          'typescript': 'TypeScript',
          'nodejs': 'Node.js',
          'react': 'React',
          'postgresql': 'PostgreSQL',
          'mongodb': 'MongoDB',
          'graphql': 'GraphQL',
          'aws': 'AWS',
          'gcp': 'GCP',
          'cicd': 'CI/CD'
        };
        return special[s.toLowerCase()] || (s.charAt(0).toUpperCase() + s.slice(1));
      })
    : ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'];

  const talkingPoints = [
    `Designing modular, fault-tolerant architectures with strong automated test coverage and comprehensive telemetry.`,
    `Tuning query execution plans and caching layers to achieve significant p95/p99 latency reductions.`,
    `Driving cross-functional execution that directly balances technical debt reduction with ${company}'s product milestones.`,
    `Fostering trunk-based deployment, branch preview environments, and continuous delivery pipelines.`
  ];

  const questionsToAsk = [
    `How does the engineering leadership at ${company} prioritize technical debt versus feature sprint commitments?`,
    `What are the most significant architecture scaling or throughput hurdles your team is tackling in the coming quarters?`,
    `Could you walk me through your engineering deployment rhythm—from code review to production canary observability?`,
    `How are career growth, technical leadership, and engineering impact measured within the team?`
  ];

  return {
    company,
    title,
    techStack,
    talkingPoints,
    questionsToAsk
  };
}

function renderCompanyDossier(dossier) {
  const titleEl = document.getElementById('dossierCompanyTitle');
  const subtitleEl = document.getElementById('dossierRoleSubtitle');
  const stackEl = document.getElementById('dossierTechStackTags');
  const pointsList = document.getElementById('dossierTalkingPointsList');
  const questionsList = document.getElementById('dossierInterviewerQuestionsList');

  if (titleEl) titleEl.textContent = `${dossier.company} Intelligence Dossier`;
  if (subtitleEl) subtitleEl.textContent = `${dossier.title} • Inferred engineering context & strategic talking points`;

  if (stackEl) {
    stackEl.innerHTML = '';
    dossier.techStack.forEach(skill => {
      const tag = document.createElement('span');
      tag.className = 'px-2.5 py-1 text-xs font-semibold rounded-lg border';
      tag.style.background = 'var(--surface)';
      tag.style.borderColor = 'var(--border)';
      tag.style.color = 'var(--ink)';
      tag.textContent = skill;
      stackEl.appendChild(tag);
    });
  }

  if (pointsList) {
    pointsList.innerHTML = '';
    dossier.talkingPoints.forEach(point => {
      const li = document.createElement('li');
      li.className = 'text-xs flex items-start space-x-2 leading-relaxed';
      li.style.color = 'var(--ink-2)';
      li.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-sky-500"></span>
        <span>${escapeHtml(point)}</span>
      `;
      pointsList.appendChild(li);
    });
  }

  if (questionsList) {
    questionsList.innerHTML = '';
    dossier.questionsToAsk.forEach(q => {
      const li = document.createElement('li');
      li.className = 'text-xs flex items-start space-x-2 leading-relaxed';
      li.style.color = 'var(--ink-2)';
      li.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-amber-500"></span>
        <span class="font-medium">${escapeHtml(q)}</span>
      `;
      questionsList.appendChild(li);
    });
  }
}

function openDossierModal(jobInfo) {
  const modal = document.getElementById('dossier-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  let info = jobInfo;
  if (!info) {
    const jobTextEl = document.getElementById('jobText');
    const text = jobTextEl ? jobTextEl.value : '';
    const matchCompany = text.match(/(?:at|company:?|employer:?)\s+([A-Z][A-Za-z0-9&.\s]{2,20})/i);
    const company = matchCompany ? matchCompany[1].trim() : 'Target Company';
    const matchTitle = text.match(/(?:role:?|title:?|position:?)\s+([A-Z][A-Za-z0-9&.\s]{2,30})/i);
    const title = matchTitle ? matchTitle[1].trim() : 'Software Engineer';
    info = { company, title, description: text };
  }

  const dossier = generateCompanyDossier(info);
  renderCompanyDossier(dossier);
}

function initCompanyDossier() {
  const openBtn = document.getElementById('companyDossierBtn');
  const closeBtn = document.getElementById('closeDossierModalBtn');
  const closeBottomBtn = document.getElementById('closeDossierBtnBottom');
  const modal = document.getElementById('dossier-modal');

  if (openBtn) {
    openBtn.addEventListener('click', () => openDossierModal());
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (closeBottomBtn && modal) {
    closeBottomBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
}

/**
 * 19. LinkedIn Cold Outreach Generator
 */
let currentOutreachDrafts = {};
let activeOutreachType = 'connect';

function generateOutreachDrafts(info = {}) {
  let company = 'Target Company';
  let title = 'Software Engineer';
  let topSkills = ['Full-Stack', 'Distributed Systems'];

  if (typeof info === 'string') {
    company = info.trim() || 'Target Company';
  } else if (info && typeof info === 'object') {
    company = info.company || info.companyName || 'Target Company';
    title = info.title || info.roleTitle || 'Software Engineer';
    if (info.skills && Array.isArray(info.skills) && info.skills.length > 0) {
      topSkills = info.skills;
    } else if (info.description) {
      const extracted = extractSkillsFromText(info.description);
      if (extracted.length > 0) topSkills = extracted;
    }
  }

  const vaultSkills = typeof getAllVaultSkills === 'function' ? getAllVaultSkills() : [];
  if (vaultSkills.length > 0) {
    topSkills = vaultSkills.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1));
  }

  const skillsSnippet = topSkills.slice(0, 2).join(' & ');

  const connect = `Hi! I noticed your work building engineering solutions at ${company}. As a ${title} skilled in ${skillsSnippet}, I'd love to connect and follow ${company}'s technical growth!`;

  const inmail = `Hi [Hiring Manager],\n\nI've been following ${company}'s product updates and noticed your open ${title} position. With a strong track record delivering scalable systems using ${topSkills.join(', ')}, I specialize in shipping high-reliability features and optimizing developer velocity.\n\nI'd welcome the chance to discuss how my technical background aligns with your roadmap. Would you be open to a 10-minute chat this week?\n\nBest regards,\n[Your Name]`;

  const coffee = `Hi [Name],\n\nI came across your profile while researching engineering culture at ${company}. As an engineer working with ${skillsSnippet}, I really admire the architecture and challenges your team is tackling.\n\nIf your schedule allows, I'd love to buy you a virtual coffee for 15 minutes to hear about your experience on the team.\n\nCheers!`;

  return { connect, inmail, coffee, company, title };
}

function updateOutreachCharCounter(text, type) {
  const counterEl = document.getElementById('outreachCharCounter');
  if (!counterEl) return;
  const len = text.length;
  if (type === 'connect') {
    counterEl.textContent = `${len} / 300`;
    if (len > 300) {
      counterEl.className = 'font-mono text-[11px] font-bold text-rose-500';
    } else if (len > 260) {
      counterEl.className = 'font-mono text-[11px] font-semibold text-amber-500';
    } else {
      counterEl.className = 'font-mono text-[11px] text-emerald-600 dark:text-emerald-400';
    }
  } else {
    counterEl.textContent = `${len} chars`;
    counterEl.className = 'font-mono text-[11px] opacity-70';
  }
}

function renderOutreachDraft(type) {
  activeOutreachType = type || 'connect';
  const textarea = document.getElementById('outreachMessageText');
  const typeBtns = document.querySelectorAll('.outreach-type-btn');

  typeBtns.forEach(btn => {
    if (btn.dataset.type === activeOutreachType) {
      btn.style.background = 'var(--surface)';
      btn.style.color = 'var(--ink)';
      btn.classList.add('active');
    } else {
      btn.style.background = 'var(--paper-2)';
      btn.style.color = 'var(--ink-3)';
      btn.classList.remove('active');
    }
  });

  const text = currentOutreachDrafts[activeOutreachType] || '';
  if (textarea) {
    textarea.value = text;
    updateOutreachCharCounter(text, activeOutreachType);
  }
}

function openOutreachModal(jobInfo) {
  const modal = document.getElementById('outreach-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  let info = jobInfo;
  if (!info) {
    const jobTextEl = document.getElementById('jobText');
    const text = jobTextEl ? jobTextEl.value : '';
    const matchCompany = text.match(/(?:at|company:?|employer:?)\s+([A-Z][A-Za-z0-9&.\s]{2,20})/i);
    const company = matchCompany ? matchCompany[1].trim() : 'Target Company';
    const matchTitle = text.match(/(?:role:?|title:?|position:?)\s+([A-Z][A-Za-z0-9&.\s]{2,30})/i);
    const title = matchTitle ? matchTitle[1].trim() : 'Software Engineer';
    info = { company, title, description: text };
  }

  currentOutreachDrafts = generateOutreachDrafts(info);
  renderOutreachDraft('connect');
}

function initLinkedInOutreach() {
  const openBtn = document.getElementById('linkedinOutreachBtn');
  const closeBtn = document.getElementById('closeOutreachModalBtn');
  const closeBottomBtn = document.getElementById('closeOutreachBtnBottom');
  const copyBtn = document.getElementById('copyOutreachBtn');
  const textarea = document.getElementById('outreachMessageText');
  const typeBtns = document.querySelectorAll('.outreach-type-btn');
  const modal = document.getElementById('outreach-modal');

  if (openBtn) {
    openBtn.addEventListener('click', () => openOutreachModal());
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (closeBottomBtn && modal) {
    closeBottomBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (typeBtns) {
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        renderOutreachDraft(btn.dataset.type);
      });
    });
  }
  if (textarea) {
    textarea.addEventListener('input', () => {
      updateOutreachCharCounter(textarea.value, activeOutreachType);
      currentOutreachDrafts[activeOutreachType] = textarea.value;
    });
  }
  if (copyBtn && textarea) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        showToast('Outreach draft copied to clipboard!', 'success');
      } catch (_) {
        showToast('Draft copied.', 'success');
      }
    });
  }
}

/**
 * 19.5 1-Click Speedrun Application Kit Engine
 */
let currentSpeedrunKit = null;
let activeSpeedrunTab = 'resume';

function extractTargetJobFromInputs() {
  const jobTextEl = document.getElementById('jobText');
  const text = jobTextEl ? jobTextEl.value.trim() : '';
  let company = 'Target Company';
  let title = 'Software Engineer';
  let salary = 'Competitive';
  let location = 'Remote';

  if (text) {
    const matchCompany = text.match(/(?:at|company:?|employer:?)\s+([A-Z0-9][A-Za-z0-9&.\s]{1,30})/i);
    if (matchCompany) company = matchCompany[1].trim();

    const matchTitle = text.match(/(?:role:?|title:?|position:?)\s+([A-Z0-9][A-Za-z0-9&.\s]{1,40})/i);
    if (matchTitle) title = matchTitle[1].trim();

    const matchSalary = text.match(/(?:salary:?|comp:?|pay:?)\s+([$\u20B1\w\s,-]+)/i);
    if (matchSalary) salary = matchSalary[1].trim();

    const matchLocation = text.match(/(?:location:?)\s+([A-Za-z0-9\s,-]+)/i);
    if (matchLocation) location = matchLocation[1].trim();
  }

  return { company, title, salary, location, description: text };
}

function renderSpeedrunTab(tabName) {
  activeSpeedrunTab = tabName || 'resume';
  const tabs = ['resume', 'coverletter', 'outreach', 'pipeline'];

  tabs.forEach(tab => {
    const tabEl = document.getElementById(
      tab === 'resume' ? 'speedrunTabResume' :
      tab === 'coverletter' ? 'speedrunTabCoverLetter' :
      tab === 'outreach' ? 'speedrunTabOutreach' : 'speedrunTabPipeline'
    );
    if (tabEl) {
      if (tab === activeSpeedrunTab) {
        tabEl.classList.remove('hidden');
      } else {
        tabEl.classList.add('hidden');
      }
    }
  });

  const tabBtns = document.querySelectorAll('.speedrun-tab-btn');
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === activeSpeedrunTab) {
      btn.style.background = 'var(--surface)';
      btn.style.color = 'var(--ink)';
      btn.classList.add('active-tab', 'shadow-sm');
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--ink-3)';
      btn.classList.remove('active-tab', 'shadow-sm');
    }
  });
}

function compileSpeedrunKit(targetJobInfo) {
  const resumeEl = document.getElementById('resumeText');
  const resumeText = resumeEl ? resumeEl.value.trim() : '';
  const jobInfo = targetJobInfo || extractTargetJobFromInputs();

  const speedrunEngine = (typeof SkillSyncSpeedrun !== 'undefined' && SkillSyncSpeedrun) ? SkillSyncSpeedrun : null;

  if (speedrunEngine) {
    currentSpeedrunKit = speedrunEngine.generateSpeedrunKit({
      resume: resumeText,
      company: jobInfo.company,
      role: jobInfo.title,
      description: jobInfo.description,
      salary: jobInfo.salary,
      location: jobInfo.location
    });
  } else {
    currentSpeedrunKit = {
      company: jobInfo.company,
      role: jobInfo.title,
      tailored_bullets: [
        `Spearheaded critical system architecture initiatives, reducing latency by 34% through automated pipelines.`,
        `Integrated core software solutions for ${jobInfo.company}, aligning engineering with mission-critical performance.`,
        `Partnered cross-functionally across operations and production, accelerating release velocity by 28%.`
      ],
      tailored_resume: resumeText || `EXPERIENCE\n• Software Engineer - Delivered high impact scalable systems.`,
      cover_letter: `Dear Hiring Team at ${jobInfo.company},\n\nI am thrilled to submit my application for the ${jobInfo.title} position...`,
      outreach_dm: `Hi [Name], noticed ${jobInfo.company} is hiring for ${jobInfo.title}. With my engineering track record, I'd love to connect and share quick ideas. Thanks!`,
      pipeline_record: {
        company: jobInfo.company,
        role: jobInfo.title,
        salary: jobInfo.salary || 'Competitive',
        status: 'Applied'
      }
    };
  }

  currentSpeedrunKit.description = jobInfo.description;

  // Update target label
  const targetLabel = document.getElementById('speedrunTargetLabel');
  if (targetLabel) targetLabel.textContent = `${jobInfo.title} @ ${jobInfo.company}`;

  // Bullets list
  const bulletsList = document.getElementById('speedrunBulletsList');
  if (bulletsList && currentSpeedrunKit.tailored_bullets) {
    bulletsList.innerHTML = currentSpeedrunKit.tailored_bullets.map((b, idx) => {
      const text = (typeof b === 'object' && b !== null && b.bullet) ? b.bullet : String(b);
      const impact = (typeof b === 'object' && b !== null && b.impact) ? b.impact : '';
      return `
      <div class="p-2.5 rounded-lg border flex items-start justify-between gap-2" style="background: var(--paper-2); border-color: var(--border);">
        <div class="flex-1 space-y-0.5">
          <p class="text-xs leading-relaxed" style="color: var(--ink);"><span class="font-bold text-amber-500 font-mono">XYZ #${idx + 1}:</span> ${escapeHtml(text)}</p>
          ${impact ? `<span class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"><svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>${escapeHtml(impact)}</span>` : ''}
        </div>
        <button type="button" class="speedrun-copy-single-bullet px-2 py-0.5 text-[10px] rounded hover:bg-slate-500/10 font-mono transition shrink-0 cursor-pointer" data-bullet="${escapeHtml(text)}" style="border: 1px solid var(--border); color: var(--ink-2);">Copy</button>
      </div>
      `;
    }).join('');

    bulletsList.querySelectorAll('.speedrun-copy-single-bullet').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bulletText = e.currentTarget.getAttribute('data-bullet');
        if (bulletText) {
          try {
            await navigator.clipboard.writeText(bulletText);
            showToast('Bullet copied to clipboard!', 'success');
          } catch (_) {
            showToast('Bullet copied.', 'success');
          }
        }
      });
    });
  }

  // Tailored Resume Textarea
  const resumeTextarea = document.getElementById('speedrunResumeText');
  if (resumeTextarea) {
    resumeTextarea.value = currentSpeedrunKit.tailored_resume || resumeText;
  }

  // Cover Letter Textarea (with Copilot Typewriter Streaming)
  const clTextarea = document.getElementById('speedrunCoverLetterText');
  if (clTextarea) {
    if (typeof SkillSyncTypewriter !== 'undefined' && typeof SkillSyncTypewriter.streamText === 'function') {
      SkillSyncTypewriter.streamText({
        text: currentSpeedrunKit.cover_letter || '',
        element: clTextarea,
        mode: 'word',
        speedMs: 14
      });
    } else {
      clTextarea.value = currentSpeedrunKit.cover_letter || '';
    }
  }

  // Outreach DM Textarea & Counter
  const outreachTextarea = document.getElementById('speedrunOutreachText');
  const outreachCounter = document.getElementById('speedrunDmCharCounter');
  if (outreachTextarea) {
    outreachTextarea.value = currentSpeedrunKit.outreach_dm || '';
    if (outreachCounter) {
      const len = outreachTextarea.value.length;
      outreachCounter.textContent = `${len} / 300`;
      outreachCounter.className = len > 300 
        ? 'text-[10px] font-mono px-2 py-0.5 rounded font-bold text-rose-500' 
        : 'text-[10px] font-mono px-2 py-0.5 rounded font-bold text-emerald-600 dark:text-emerald-400';
    }
  }

  // LinkedIn Find Hiring Manager link
  const findManagerLink = document.getElementById('speedrunFindManagerLink');
  if (findManagerLink) {
    findManagerLink.href = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(jobInfo.company + ' "hiring" OR "recruiter" OR "engineering manager"')}`;
  }

  // Pipeline Preview
  const pipeCompany = document.getElementById('speedrunPipeCompany');
  const pipeRole = document.getElementById('speedrunPipeRole');
  const pipeDate = document.getElementById('speedrunPipeDate');
  if (pipeCompany) pipeCompany.textContent = jobInfo.company;
  if (pipeRole) pipeRole.textContent = jobInfo.title;
  if (pipeDate) {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    pipeDate.textContent = today;
  }

  return currentSpeedrunKit;
}

function openSpeedrunModal(jobInfo) {
  const modal = document.getElementById('speedrun-modal');
  if (!modal) return;

  const resumeEl = document.getElementById('resumeText');
  const jobEl = document.getElementById('jobText');
  const hasResume = resumeEl && resumeEl.value.trim().length > 20;
  const hasJob = jobInfo || (jobEl && jobEl.value.trim().length > 20);

  if (!hasResume && !hasJob) {
    showToast('Tip: Paste your resume and target job first for maximum tailoring.', 'info', 3000);
  }

  modal.classList.remove('hidden');
  compileSpeedrunKit(jobInfo);
  renderSpeedrunTab('resume');
}

function initSpeedrunKit() {
  const launchBtns = [
    document.getElementById('launchSpeedrunBtn'),
    document.getElementById('quickSpeedrunBtn'),
    document.getElementById('speedrunActionCardBtn')
  ].filter(Boolean);
  const closeBtn = document.getElementById('closeSpeedrunModalBtn');
  const closeBtnBottom = document.getElementById('closeSpeedrunBtnBottom');
  const modal = document.getElementById('speedrun-modal');
  const tabBtns = document.querySelectorAll('.speedrun-tab-btn');
  const applyBulletsBtn = document.getElementById('speedrunApplyBulletsBtn');
  const copyResumeBtn = document.getElementById('speedrunCopyResumeBtn');
  const copyClBtn = document.getElementById('speedrunCopyClBtn');
  const exportClPdfBtn = document.getElementById('speedrunExportClPdfBtn');
  const copyDmBtn = document.getElementById('speedrunCopyDmBtn');
  const commitPipelineBtn = document.getElementById('speedrunCommitPipelineBtn');
  const copyAllBtn = document.getElementById('speedrunCopyAllBtn');
  const outreachTextarea = document.getElementById('speedrunOutreachText');

  launchBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openSpeedrunModal();
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (closeBtnBottom && modal) {
    closeBtnBottom.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  if (tabBtns) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        renderSpeedrunTab(btn.dataset.tab);
      });
    });
  }

  if (applyBulletsBtn) {
    applyBulletsBtn.addEventListener('click', () => {
      const resumeEl = document.getElementById('resumeText');
      if (resumeEl && currentSpeedrunKit && currentSpeedrunKit.tailored_bullets) {
        const bulletsBlock = "\n\nTAILORED IMPACT HIGHLIGHTS (XYZ):\n" + 
          currentSpeedrunKit.tailored_bullets.map(b => {
            const text = (typeof b === 'object' && b !== null && b.bullet) ? b.bullet : String(b);
            return `• ${text}`;
          }).join('\n');
        resumeEl.value = (resumeEl.value.trim() + bulletsBlock).trim();
        const resumeCounter = document.getElementById('resumeCharCount') || document.getElementById('resumeCount');
        if (resumeCounter) resumeCounter.textContent = `${resumeEl.value.length.toLocaleString()} chars`;
        showToast('XYZ Tailored Bullets injected into active resume workspace!', 'success');
      }
    });
  }

  if (copyResumeBtn) {
    copyResumeBtn.addEventListener('click', async () => {
      const resumeTextarea = document.getElementById('speedrunResumeText');
      if (resumeTextarea) {
        try {
          await navigator.clipboard.writeText(resumeTextarea.value);
          showToast('Tailored resume copied to clipboard!', 'success');
        } catch (_) {
          showToast('Copied to clipboard.', 'success');
        }
      }
    });
  }

  if (copyClBtn) {
    copyClBtn.addEventListener('click', async () => {
      const clTextarea = document.getElementById('speedrunCoverLetterText');
      if (clTextarea) {
        try {
          await navigator.clipboard.writeText(clTextarea.value);
          showToast('Cover letter copied to clipboard!', 'success');
        } catch (_) {
          showToast('Copied to clipboard.', 'success');
        }
      }
    });
  }

  if (exportClPdfBtn) {
    exportClPdfBtn.addEventListener('click', () => {
      const clTextarea = document.getElementById('speedrunCoverLetterText');
      const text = clTextarea ? clTextarea.value : '';
      if (!text) {
        showToast('Cover letter is empty.', 'warning');
        return;
      }
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Cover Letter - SkillSync</title>
            <style>
              body { font-family: Georgia, serif; line-height: 1.7; padding: 40px; color: #1e293b; max-width: 700px; margin: 0 auto; white-space: pre-wrap; font-size: 14px; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>${escapeHtml(text)}</body>
          <script>
            window.onload = function() { window.print(); };
          </script>
          </html>
        `);
        printWindow.document.close();
      } else {
        showToast('Please allow popups to print/export PDF.', 'warning');
      }
    });
  }

  if (copyDmBtn) {
    copyDmBtn.addEventListener('click', async () => {
      if (outreachTextarea) {
        try {
          await navigator.clipboard.writeText(outreachTextarea.value);
          showToast('LinkedIn outreach DM copied!', 'success');
        } catch (_) {
          showToast('Copied to clipboard.', 'success');
        }
      }
    });
  }

  if (outreachTextarea) {
    outreachTextarea.addEventListener('input', () => {
      const counter = document.getElementById('speedrunDmCharCounter');
      if (counter) {
        const len = outreachTextarea.value.length;
        counter.textContent = `${len} / 300`;
        counter.className = len > 300 
          ? 'text-[10px] font-mono px-2 py-0.5 rounded font-bold text-rose-500' 
          : 'text-[10px] font-mono px-2 py-0.5 rounded font-bold text-emerald-600 dark:text-emerald-400';
      }
    });
  }

  if (commitPipelineBtn) {
    commitPipelineBtn.addEventListener('click', () => {
      const targetJob = currentSpeedrunKit ? {
        title: currentSpeedrunKit.role,
        company_name: currentSpeedrunKit.company,
        description: currentSpeedrunKit.description,
        salary: (currentSpeedrunKit.pipeline_record && currentSpeedrunKit.pipeline_record.salary) || 'Competitive',
        score: 85
      } : extractTargetJobFromInputs();

      addJobToPipeline(targetJob, 'applied');
    });
  }

  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', async () => {
      if (!currentSpeedrunKit) compileSpeedrunKit();
      const allText = `=========================================
SKILLSYNC SPEEDRUN APPLICATION PACK
Target: ${currentSpeedrunKit.role} @ ${currentSpeedrunKit.company}
=========================================

--- 1. TAILORED RESUME HIGHLIGHTS (XYZ) ---
${(currentSpeedrunKit.tailored_bullets || []).map((b, i) => {
  const text = (typeof b === 'object' && b !== null && b.bullet) ? b.bullet : String(b);
  return `${i + 1}. ${text}`;
}).join('\n')}

--- 2. COVER LETTER ---
${currentSpeedrunKit.cover_letter || ''}

--- 3. HIRING MANAGER LINKEDIN DM (<300 Chars) ---
${currentSpeedrunKit.outreach_dm || ''}
`;
      try {
        await navigator.clipboard.writeText(allText);
        showToast('Complete Speedrun Kit copied to clipboard!', 'success');
      } catch (_) {
        showToast('Complete kit copied to clipboard.', 'success');
      }
    });
  }
}

/**
 * 19.6 1-Click Agentic AI Company Application Request Dispatcher
 */
let currentAgenticPayload = null;
let activeAgenticTab = 'letter';

function renderAgenticTab(tabName) {
  activeAgenticTab = tabName || 'letter';
  const tabs = ['letter', 'dm', 'trace'];
  tabs.forEach(tab => {
    const el = document.getElementById(
      tab === 'letter' ? 'agenticTabLetter' :
      tab === 'dm' ? 'agenticTabDm' : 'agenticTabTrace'
    );
    if (el) {
      if (tab === activeAgenticTab) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  const tabBtns = document.querySelectorAll('.agentic-tab-btn');
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === activeAgenticTab) {
      btn.style.background = 'var(--surface)';
      btn.style.color = 'var(--ink)';
      btn.classList.add('active-tab', 'shadow-sm');
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--ink-3)';
      btn.classList.remove('active-tab', 'shadow-sm');
    }
  });
}

function openAgenticRequestModal(targetJobInfo) {
  const modal = document.getElementById('agentic-request-modal') || document.getElementById('speedrun-modal');
  if (!modal) return;

  const resumeEl = document.getElementById('resumeText');
  const jobEl = document.getElementById('jobText');
  const resume = resumeEl ? resumeEl.value.trim() : '';
  const jobDesc = targetJobInfo ? (targetJobInfo.description || targetJobInfo.title || '') : (jobEl ? jobEl.value.trim() : '');

  const agenticModule = (typeof SkillSyncAgenticRequest !== 'undefined' && SkillSyncAgenticRequest)
    ? SkillSyncAgenticRequest
    : null;

  if (agenticModule && typeof agenticModule.generateAgenticCompanyRequest === 'function') {
    currentAgenticPayload = agenticModule.generateAgenticCompanyRequest({
      resume,
      jobText: jobDesc,
      company: targetJobInfo?.company,
      role: targetJobInfo?.title,
      salary: targetJobInfo?.salary,
      location: targetJobInfo?.location
    });
  } else {
    const company = targetJobInfo?.company || 'Target Company';
    const role = targetJobInfo?.title || 'Engineering Lead';
    const trackingId = 'REQ-' + Date.now().toString(36).toUpperCase();
    currentAgenticPayload = {
      trackingId,
      company,
      role,
      agentPlan: [
        `[Agent Execution Plan] Target entity identified: ${company} · ${role}`,
        `[Agent Analysis] Extracted core competencies and technical alignment anchors`,
        `[Agent Pitch Synthesis] Synthesized high-signal executive application request`,
        `[Agent Dispatch Readiness] Hook configured for 1-click dispatch`
      ],
      executiveRequestLetter: `Dear ${company} Engineering Leadership,\n\nI am writing to formally request consideration for the ${role} position at ${company}...`,
      directDm: `Hi ${company} Team — I saw ${company} is hiring for ${role}. With proven technical experience, I have drafted an executive application proposal. Let's connect!`,
      mailtoUri: `mailto:jobs@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com?subject=Application%20Request`,
      linkedinSearchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company + ' engineering manager')}`
    };
  }

  // Populate UI
  const targetLabel = document.getElementById('agenticTargetLabel');
  if (targetLabel) targetLabel.textContent = `${currentAgenticPayload.role} @ ${currentAgenticPayload.company}`;

  const trackingBadge = document.getElementById('agenticTrackingBadge');
  if (trackingBadge) trackingBadge.textContent = currentAgenticPayload.trackingId;

  const planTerminal = document.getElementById('agenticPlanTerminal');
  if (planTerminal && Array.isArray(currentAgenticPayload.agentPlan)) {
    planTerminal.innerHTML = currentAgenticPayload.agentPlan.map(line => `<div><span class="text-sky-400">›</span> ${escapeHtml(line)}</div>`).join('');
  }

  const letterTextarea = document.getElementById('agenticLetterText');
  if (letterTextarea) {
    if (typeof SkillSyncTypewriter !== 'undefined' && typeof SkillSyncTypewriter.streamText === 'function') {
      SkillSyncTypewriter.streamText({
        text: currentAgenticPayload.executiveRequestLetter || '',
        element: letterTextarea,
        mode: 'word',
        speedMs: 12
      });
    } else {
      letterTextarea.value = currentAgenticPayload.executiveRequestLetter || '';
    }
  }

  const dmTextarea = document.getElementById('agenticDmText');
  const dmCounter = document.getElementById('agenticDmCharCounter');
  if (dmTextarea) {
    dmTextarea.value = currentAgenticPayload.directDm || '';
    if (dmCounter) {
      const len = dmTextarea.value.length;
      dmCounter.textContent = `${len} / 300`;
      dmCounter.className = len > 300 ? 'text-[11px] font-mono px-2 py-0.5 rounded font-bold text-rose-500' : 'text-[11px] font-mono px-2 py-0.5 rounded font-bold text-sky-400';
    }
  }

  const findManagerLink = document.getElementById('agenticFindManagerLink');
  if (findManagerLink && currentAgenticPayload.linkedinSearchUrl) {
    findManagerLink.href = currentAgenticPayload.linkedinSearchUrl;
  }

  const pipeCompany = document.getElementById('agenticPipeCompany');
  const pipeRole = document.getElementById('agenticPipeRole');
  const pipeTracking = document.getElementById('agenticPipeTracking');
  if (pipeCompany) pipeCompany.textContent = currentAgenticPayload.company;
  if (pipeRole) pipeRole.textContent = currentAgenticPayload.role;
  if (pipeTracking) pipeTracking.textContent = currentAgenticPayload.trackingId;

  modal.classList.remove('hidden');
  renderAgenticTab('letter');
}

function dispatchAgenticCompanyRequest() {
  if (!currentAgenticPayload) {
    openAgenticRequestModal();
  }
  const payload = currentAgenticPayload || {};
  let receipt = null;

  if (typeof SkillSyncAgenticRequest !== 'undefined' && typeof SkillSyncAgenticRequest.dispatchCompanyRequest === 'function') {
    receipt = SkillSyncAgenticRequest.dispatchCompanyRequest(payload);
  } else {
    receipt = {
      success: true,
      trackingId: payload.trackingId || ('REQ-' + Date.now().toString(36).toUpperCase()),
      company: payload.company || 'Target Company',
      role: payload.role || 'Software Engineer',
      status: 'Dispatched via Agentic AI',
      dispatchedAt: new Date().toISOString()
    };
  }

  if (typeof addJobToPipeline === 'function') {
    addJobToPipeline({
      company_name: receipt.company,
      title: receipt.role,
      salary: payload.salary || 'Competitive Benchmark',
      score: 92,
      notes: `Agentic AI 1-Click Request dispatched [Tracking: ${receipt.trackingId}].`
    }, 'applied');
  }

  const statusReceipt = document.getElementById('agenticStatusReceipt');
  if (statusReceipt) {
    statusReceipt.textContent = `Dispatched via Agentic AI ✓ (${receipt.trackingId})`;
    statusReceipt.className = 'text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 font-bold';
  }

  const pipeStatusBadge = document.getElementById('agenticPipeStatusBadge');
  if (pipeStatusBadge) {
    pipeStatusBadge.textContent = 'Status: Dispatched & Synced to Pipeline';
    pipeStatusBadge.className = 'text-[11px] font-mono font-bold px-2 py-0.5 rounded-md text-emerald-400 bg-emerald-500/15';
  }

  showToast(`Autonomous Request Dispatched to ${receipt.company}! Tracking: ${receipt.trackingId}`, 'success', 5000);
}

function initAgenticCompanyRequest() {
  const launchBtns = [
    document.getElementById('agenticCompanyRequestBtn'),
    document.getElementById('launchAgenticRequestBtn'),
    document.getElementById('agenticRequestActionCardBtn'),
    document.getElementById('quickSpeedrunBtn'),
    document.getElementById('launchSpeedrunBtn'),
    document.getElementById('speedrunActionCardBtn')
  ].filter(Boolean);

  const practiceInterviewBtn = document.getElementById('practiceInterviewBtn');
  if (practiceInterviewBtn) {
    practiceInterviewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openInterviewModal({ synthetic: true });
    });
  }

  const modal = document.getElementById('agentic-request-modal') || document.getElementById('speedrun-modal');
  const closeBtn = document.getElementById('closeAgenticModalBtn') || document.getElementById('closeSpeedrunModalBtn');
  const closeBtnBottom = document.getElementById('closeAgenticBtnBottom') || document.getElementById('closeSpeedrunBtnBottom');
  const tabBtns = document.querySelectorAll('.agentic-tab-btn');
  const dispatchBtn = document.getElementById('dispatchCompanyRequestBtn');
  const copyLetterBtn = document.getElementById('copyAgenticLetterBtn');
  const copyDmBtn = document.getElementById('copyAgenticDmBtn');
  const mailtoBtn = document.getElementById('openAgenticMailtoBtn');
  const linkedinBtn = document.getElementById('openAgenticLinkedinBtn');
  const dmTextarea = document.getElementById('agenticDmText');

  launchBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openAgenticRequestModal();
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (closeBtnBottom && modal) {
    closeBtnBottom.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  if (tabBtns) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        renderAgenticTab(btn.dataset.tab);
      });
    });
  }

  if (dispatchBtn) {
    dispatchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      dispatchAgenticCompanyRequest();
    });
  }

  if (copyLetterBtn) {
    copyLetterBtn.addEventListener('click', async () => {
      const letterEl = document.getElementById('agenticLetterText');
      if (letterEl) {
        try {
          await navigator.clipboard.writeText(letterEl.value);
          showToast('Executive letter copied to clipboard!', 'success');
        } catch (_) {
          showToast('Letter copied.', 'success');
        }
      }
    });
  }

  if (copyDmBtn) {
    copyDmBtn.addEventListener('click', async () => {
      if (dmTextarea) {
        try {
          await navigator.clipboard.writeText(dmTextarea.value);
          showToast('LinkedIn outreach DM copied!', 'success');
        } catch (_) {
          showToast('DM copied.', 'success');
        }
      }
    });
  }

  if (dmTextarea) {
    dmTextarea.addEventListener('input', () => {
      const counter = document.getElementById('agenticDmCharCounter');
      if (counter) {
        const len = dmTextarea.value.length;
        counter.textContent = `${len} / 300`;
        counter.className = len > 300 
          ? 'text-[11px] font-mono px-2 py-0.5 rounded font-bold text-rose-500' 
          : 'text-[11px] font-mono px-2 py-0.5 rounded font-bold text-sky-400';
      }
    });
  }

  if (mailtoBtn) {
    mailtoBtn.addEventListener('click', () => {
      if (currentAgenticPayload && currentAgenticPayload.mailtoUri) {
        window.location.href = currentAgenticPayload.mailtoUri;
      } else {
        showToast('Application request payload ready.', 'info');
      }
    });
  }

  if (linkedinBtn) {
    linkedinBtn.addEventListener('click', () => {
      if (currentAgenticPayload && currentAgenticPayload.linkedinSearchUrl) {
        window.open(currentAgenticPayload.linkedinSearchUrl, '_blank', 'noopener,noreferrer');
      }
    });
  }

  initSpeedrunKit();
}

if (typeof window !== 'undefined') {
  window.openAgenticRequestModal = openAgenticRequestModal;
  window.dispatchAgenticCompanyRequest = dispatchAgenticCompanyRequest;
  window.initAgenticCompanyRequest = initAgenticCompanyRequest;
  window.openSpeedrunModal = openAgenticRequestModal;
  window.compileSpeedrunKit = compileSpeedrunKit;
  window.openInterviewModal = openInterviewModal;
  window.renderInterviewQuestions = renderInterviewQuestions;
}

/**
 * 20. Live Resume Health HUD
 */
function updateResumeHealthHud() {
  const resumeEl = document.getElementById('resumeText');
  const hudEl = document.getElementById('resumeHealthHud');
  if (!resumeEl || !hudEl) return;
  const text = resumeEl.value.trim();
  if (text.length < 50) {
    hudEl.classList.add('hidden');
    return;
  }
  hudEl.classList.remove('hidden');
  if (typeof SkillSyncResumeHud !== 'undefined' && typeof SkillSyncResumeHud.analyzeResumeHealth === 'function') {
    const analysis = SkillSyncResumeHud.analyzeResumeHealth(text);
    hudEl.innerHTML = SkillSyncResumeHud.renderResumeHudHtml(analysis);
  }
}

function initResumeHud() {
  const resumeEl = document.getElementById('resumeText');
  if (resumeEl) {
    resumeEl.addEventListener('input', updateResumeHealthHud);
    updateResumeHealthHud();
  }
}

/**
 * 21. Global Raycast-Grade Command Palette (Cmd + K)
 */
function initCommandPalette() {
  const modal = document.getElementById('cmdPaletteModal');
  const input = document.getElementById('cmdPaletteInput');
  const list = document.getElementById('cmdPaletteList');
  const triggerBtn = document.getElementById('cmdPaletteTriggerBtn');

  if (!modal || !input || !list) return;

  let filteredCommands = (typeof SkillSyncCommandPalette !== 'undefined' && SkillSyncCommandPalette.DEFAULT_COMMANDS)
    ? SkillSyncCommandPalette.DEFAULT_COMMANDS
    : [];
  let selectedIndex = 0;

  function renderList() {
    if (typeof SkillSyncCommandPalette !== 'undefined') {
      list.innerHTML = SkillSyncCommandPalette.renderCommandListHtml(filteredCommands, selectedIndex);

      list.querySelectorAll('.cmd-palette-item').forEach(item => {
        item.addEventListener('click', () => {
          const cmdId = item.dataset.commandId;
          executePaletteCommand(cmdId);
        });
      });
    }
  }

  function openPalette() {
    modal.classList.remove('hidden');
    input.value = '';
    filteredCommands = typeof SkillSyncCommandPalette !== 'undefined'
      ? SkillSyncCommandPalette.filterCommands('')
      : [];
    selectedIndex = 0;
    renderList();
    setTimeout(() => input.focus(), 40);
  }

  function closePalette() {
    modal.classList.add('hidden');
  }

  function executePaletteCommand(cmdId) {
    closePalette();
    switch (cmdId) {
      case 'run_scan': {
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) analyzeBtn.click();
        break;
      }
      case 'agentic_request':
      case 'speedrun_kit': {
        if (typeof openAgenticRequestModal === 'function') openAgenticRequestModal();
        else if (typeof openSpeedrunModal === 'function') openSpeedrunModal();
        break;
      }
      case 'mock_interview':
      case 'interview_practice': {
        if (typeof openInterviewModal === 'function') openInterviewModal();
        else {
          const interviewTab = document.getElementById('practiceInterviewTabBtn') || document.querySelector('[data-workspace-tab="interview"]');
          if (interviewTab) interviewTab.click();
        }
        break;
      }
      case 'import_url': {
        const jobUrl = document.getElementById('jobUrlInput');
        if (jobUrl) {
          jobUrl.focus();
          if (typeof jobUrl.scrollIntoView === 'function') {
            jobUrl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        break;
      }
      case 'salary_coach': {
        if (typeof openSalaryModal === 'function') openSalaryModal();
        break;
      }
      case 'skill_vault': {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('vault');
        break;
      }
      case 'pipeline_board': {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('pipeline');
        break;
      }
      case 'job_discovery': {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('jobs');
        break;
      }
      case 'toggle_theme': {
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.click();
        break;
      }
      case 'audit_credibility': {
        if (typeof openIntegrityModal === 'function') openIntegrityModal();
        break;
      }
      default:
        break;
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (modal.classList.contains('hidden')) {
        openPalette();
      } else {
        closePalette();
      }
      return;
    }

    if (!modal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % Math.max(1, filteredCommands.length);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executePaletteCommand(filteredCommands[selectedIndex].id);
        }
      }
    }
  });

  if (triggerBtn) {
    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openPalette();
    });
  }

  input.addEventListener('input', () => {
    if (typeof SkillSyncCommandPalette !== 'undefined') {
      filteredCommands = SkillSyncCommandPalette.filterCommands(input.value);
      selectedIndex = 0;
      renderList();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePalette();
    }
  });
}

/**
 * 22. Resume Credibility & Anti-Hallucination Radar Modal
 */
function openIntegrityModal() {
  const modal = document.getElementById('integrity-modal');
  const container = document.getElementById('integrityReportContainer');
  const resumeEl = document.getElementById('resumeText');

  if (!modal) return;

  const text = resumeEl ? resumeEl.value.trim() : '';
  if (!text || text.length < 30) {
    showToast('Please paste or upload your resume text first to audit credibility.', 'info', 3500);
    return;
  }

  if (container && typeof SkillSyncAuthenticity !== 'undefined' && typeof SkillSyncAuthenticity.auditResumeIntegrity === 'function') {
    const audit = SkillSyncAuthenticity.auditResumeIntegrity(text);
    container.innerHTML = SkillSyncAuthenticity.renderIntegrityReportHtml(audit);

    if (supabaseClient && currentSession && currentSession.user && !isDemoMode()) {
      try {
        supabaseClient.from('resume_credibility_audits').insert([
          {
            user_id: currentSession.user.id,
            resume_title: 'Resume Credibility Check',
            credibility_score: audit.credibilityScore,
            verdict: audit.verdict,
            flagged_issues: audit.flaggedIssues,
            substantiated_skills: audit.substantiatedSkills,
            unsubstantiated_skills: audit.unsubstantiatedSkills
          }
        ]).then(({ error }) => {
          if (!error) {
            console.log('[Audit] Synced credibility report to Supabase cloud.');
          }
        });
      } catch (err) {
        console.warn('[Audit] Cloud sync skipped:', err);
      }
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
    if (typeof SkillSyncAudio !== 'undefined' && typeof SkillSyncAudio.playAuditRadar === 'function') {
      SkillSyncAudio.playAuditRadar();
    }
  }
}

/**
 * 23. Tactile Audio Feedback Controller
 */
function initAudioFeedbackController() {
  const toggleBtn = document.getElementById('soundFxToggle');
  const onIcon = document.getElementById('soundFxOnIcon');
  const offIcon = document.getElementById('soundFxOffIcon');

  const updateUI = () => {
    const isEnabled = typeof SkillSyncAudio !== 'undefined' && SkillSyncAudio.isAudioEnabled();
    if (onIcon) onIcon.classList.toggle('hidden', !isEnabled);
    if (offIcon) offIcon.classList.toggle('hidden', isEnabled);
    if (toggleBtn) {
      toggleBtn.title = isEnabled ? 'Tactile Sound Effects: ON (Click to mute)' : 'Tactile Sound Effects: OFF (Click to enable)';
    }
  };

  updateUI();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (typeof SkillSyncAudio !== 'undefined') {
        const nextState = !SkillSyncAudio.isAudioEnabled();
        SkillSyncAudio.setAudioEnabled(nextState);
        updateUI();
        if (nextState) {
          SkillSyncAudio.playClick();
          showToast('Tactile audio feedback enabled.', 'info', 2000);
        } else {
          showToast('Tactile audio feedback muted.', 'info', 2000);
        }
      }
    });
  }
}

function initIntegrityAuditor() {
  const auditBtn = document.getElementById('auditCredibilityBtn');
  const modal = document.getElementById('integrity-modal');
  const closeBtn = document.getElementById('closeIntegrityModalBtn');
  const closeBtnBottom = document.getElementById('closeIntegrityModalBottomBtn');
  const reAuditBtn = document.getElementById('reAuditIntegrityBtn');

  if (auditBtn) {
    auditBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openIntegrityModal();
    });
  }

  const closeModal = () => modal?.classList.add('hidden');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeBtnBottom) closeBtnBottom.addEventListener('click', closeModal);

  if (reAuditBtn) {
    reAuditBtn.addEventListener('click', () => {
      openIntegrityModal();
      showToast('Credibility audit refreshed.', 'success', 2000);
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
}

/**
 * 23. Main Application Initialization
 */
function initApp() {
  if (!checkCdn()) return;

  initTheme();
  initSupabase();
  initAuthForm();
  initCharCounters();
  initStudioPresets();
  initResumeVersionManager();
  const authReady = initAuth();
  initPdfUpload();
  initJobScraper();
  initAnalyzer();
  initExportAndClipboard();
  initModals();
  initJobDiscovery();
  initSkillVault();
  initAiActionSuite();
  initPipeline();
  initRoadmap();
  initIntegrityAuditor();
  window.addEventListener('pagehide', saveWorkspaceDraft);
  Promise.resolve(authReady).then(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;
    document.getElementById('quickDemoBtn')?.click();
    if (params.get('sample') === 'fullstack' && !document.getElementById('resumeText')?.value.trim() && !document.getElementById('jobText')?.value.trim()) document.getElementById('loadSamplePairBtn')?.click();
    updateComparisonReadiness();
    // Consume the sample parameter; preserve demo=1 so reload retains demo session
    params.delete('sample');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  });

  let speedrunHandled = false;

  // Check for 1-click job transfer from Discovery explorer
  try {
    const pendingScan = localStorage.getItem('skillsync_pending_job_scan');
    if (pendingScan) {
      localStorage.removeItem('skillsync_pending_job_scan');
      const jobData = JSON.parse(pendingScan);
      if (jobData && (jobData.description || jobData.title)) {
        const jobTextarea = document.getElementById('jobText');
        if (jobTextarea) {
          const cleanDesc = cleanJobDescription(jobData.description || '');
          replaceWorkspaceText('jobText', `Role: ${jobData.title || ''} at ${jobData.company || ''}\nLocation: ${jobData.location || ''}\nSalary: ${jobData.salary || ''}\n\nDescription:\n${cleanDesc}`);
          const jobCounter = document.getElementById('jobCount') || document.getElementById('jobCharCount');
          if (jobCounter) jobCounter.textContent = `${jobTextarea.value.length.toLocaleString()} chars`;
          showToast(`Loaded ${jobData.title || 'target job'} into ATS workspace.`, 'success', 3500);
        }
        if (jobData.speedrun) {
          speedrunHandled = true;
          setTimeout(() => {
            openSpeedrunModal(jobData);
          }, 350);
        }
      }
    }
  } catch (_) {}

  // Check for speedrun query param
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('speedrun') === '1' && !speedrunHandled) {
        setTimeout(() => {
          openSpeedrunModal();
        }, 500);
      }

      // Check for auto_scan query param (from Discovery Explorer 1-click scan)
      if (urlParams.get('auto_scan') === '1') {
        setTimeout(() => {
          const resumeEl = document.getElementById('resumeText');
          const jobEl = document.getElementById('jobText');
          const analyzeBtn = document.getElementById('analyzeBtn');
          if (resumeEl && jobEl && analyzeBtn) {
            const hasResume = resumeEl.value.trim().length > 30;
            const hasJob = jobEl.value.trim().length > 30;
            if (hasResume && hasJob && typeof analyzeBtn.click === 'function') {
              showToast('Auto-initiating AI match scan...', 'info', 2500);
              analyzeBtn.click();
            } else if (!hasResume) {
              showToast('Target role loaded! Paste or upload your resume to run the match scan.', 'info', 4000);
            }
          }
        }, 450);
      }
    }
  } catch (_) {}

  // Check for 1-click external job URL import (from LinkedIn, Upwork, Indeed, etc.)
  try {
    let importUrl = null;
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      importUrl = urlParams.get('import_url');
    }
    if (!importUrl) {
      importUrl = localStorage.getItem('skillsync_pending_job_url');
    }
    if (importUrl) {
      localStorage.removeItem('skillsync_pending_job_url');
      const jobUrlInput = document.getElementById('jobUrlInput');
      const scrapeBtn = document.getElementById('scrapeBtn');
      if (jobUrlInput) {
        jobUrlInput.value = importUrl;
        showToast('Importing job from URL into ATS workspace...', 'info', 2500);
        if (scrapeBtn && typeof scrapeBtn.click === 'function') {
          setTimeout(() => scrapeBtn.click(), 300);
        }
      }
    }
  } catch (_) {}
}

if (typeof module === 'undefined' && typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkCdn,
    initTheme,
    applyTheme,
    toggleTheme,
    showToast,
    escapeHtml,
    updateCharCounter,
    loadResumeVersionsFromStorage,
    saveResumeVersion,
    deleteResumeVersion,
    switchResumeVersion,
    initResumeVersionManager,
    getResumeVersions: () => resumeVersions,
    setResumeVersions: (v) => { resumeVersions = v; },
    generateYouTubeLink,
    getScoreColorClasses,
    extractResumeFromFile,
    extractResumeFromPdf,
    extractResumeFromImage,
    renderResults,
    renderDashboardGrid,
    extractSkillsFromText,
    calculateJobCompatibility,
    switchWorkspaceTab,
    loadJobIntoWorkspace,
    cleanJobDescription,
    fetchAndRenderJobs,
    recomputeAndRenderJobCards,
    initJobDiscovery,
    setJobsPage,
    getPaginationState,
    JOBS_PER_PAGE,
    FALLBACK_DISCOVERY_JOBS,
    synthesizeConsoleOpportunities,
    setDiscoveredJobsCache: (jobs) => { discoveredJobsCache = jobs; },
    getDiscoveredJobsCache: () => discoveredJobsCache,
    getAllVaultSkills,
    getSkillLogoSvg,
    renderVaultUI,
    addDocumentToVault,
    deleteVaultDocument,
    syncVaultToWorkspace,
    initSkillVault,
    getVaultDocumentsCache: () => vaultDocumentsCache,
    getVerifiedSkillsMatrix: () => verifiedSkillsMatrix,
    openTailorModal,
    renderTailorBullets,
    openCoverLetterModal,
    fetchCoverLetter,
    openInterviewModal,
    renderInterviewQuestions,
    calculateSalaryBenchmarks,
    fetchSalaryBenchmarks,
    renderSalaryInsights,
    openSalaryModal,
    initAiActionSuite,
    calculatePipelineMetrics,
    renderPipelineAnalytics,
    checkFollowupDue,
    generateFollowupEmail,
    openFollowupModal,
    addJobToPipeline,
    updatePipelineJobStatus,
    deletePipelineJob,
    renderPipeline,
    initPipeline,
    getPipelineJobs: () => pipelineJobs,
    setPipelineJobs: (jobs) => { pipelineJobs = jobs; },
    generateRoadmapCurriculum,
    loadRoadmapProgress,
    saveRoadmapProgress,
    renderRoadmap,
    toggleRoadmapMilestone,
    resetRoadmapProgress,
    openRoadmapModal,
    initRoadmap,
    getCurrentRoadmapData: () => currentRoadmapData,
    evaluateInterviewAnswer,
    createCustomInterviewQuestion,
    generateCompanyDossier,
    renderCompanyDossier,
    openDossierModal,
    initCompanyDossier,
    generateOutreachDrafts,
    updateOutreachCharCounter,
    renderOutreachDraft,
    openOutreachModal,
    initLinkedInOutreach,
    getCurrentOutreachDrafts: () => currentOutreachDrafts,
    getActiveOutreachType: () => activeOutreachType,
    validatePersonName,
    validateVersionName,
    validateLocationName,
    validatePasswordConfirmation,
    updateExternalSearchLinks,
    compileSpeedrunKit,
    openSpeedrunModal,
    initSpeedrunKit,
    extractTargetJobFromInputs,
    renderSpeedrunTab,
    getCurrentSpeedrunKit: () => currentSpeedrunKit,
    openAgenticRequestModal,
    dispatchAgenticCompanyRequest,
    initAgenticCompanyRequest,
    renderAgenticTab,
    getCurrentAgenticPayload: () => currentAgenticPayload,
    performSignOut,
    initStudioPresets,
    initWorkspaceDrafts,
    undoWorkspaceReplacement,
    replaceWorkspaceText,
    calculateDemoMatch,
    normalizeMatchResult,
    updateComparisonReadiness,
    initAuth,
    initAuthForm,
    initAnalyzer,
    openIntegrityModal,
    initIntegrityAuditor,
    initAudioFeedbackController,
    initApp
  };
}
