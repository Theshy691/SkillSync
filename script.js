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

/**
 * Demo Mode Helper
 */
function isDemoMode() {
  const cfg = (typeof window !== 'undefined' && window.SKILLSYNC_CONFIG) || {};
  if (cfg.DEMO_MODE === true) return true;
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('your-project-id')) return true;
  if (currentSession && currentSession.access_token && currentSession.access_token.startsWith('demo-token')) return true;
  if (typeof localStorage !== 'undefined' && localStorage.getItem('skillsync_demo_session')) return true;
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
    return JSON.parse(raw);
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

  const hasTailwind = typeof tailwind !== 'undefined';
  const hasSupabase = typeof window.supabase !== 'undefined';
  const hasPdfJs = typeof window.pdfjsLib !== 'undefined';
  const hasHtml2Pdf = typeof window.html2pdf !== 'undefined';

  if (!hasTailwind || !hasSupabase || !hasPdfJs || !hasHtml2Pdf) {
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
  toast.className = 'pointer-events-auto flex items-center space-x-3 p-3.5 rounded-2xl shadow-xl border text-sm font-medium transform transition-all duration-300 opacity-0 translate-y-2';

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
      colorClasses = 'bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 border-slate-700';
      iconSvg = `<svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
      break;
  }

  toast.className += ` ${colorClasses}`;
  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1 leading-snug">${escapeHtml(message)}</div>
    <button class="toast-close text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1" aria-label="Dismiss">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

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

function updateCharCounter(inputElement, counterElement, max = 5000) {
  if (!inputElement || !counterElement) return;
  const len = inputElement.value ? inputElement.value.length : 0;
  counterElement.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
  if (len >= max) {
    counterElement.classList.add('text-rose-500', 'font-bold');
  } else {
    counterElement.classList.remove('text-rose-500', 'font-bold');
  }
}

function generateYouTubeLink(skill) {
  if (!skill) return '#';
  const query = encodeURIComponent(`learn ${skill.trim()}`);
  return `https://www.youtube.com/results?search_query=${query}`;
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
  if (isDemoMode()) {
    try {
      const demoSession = localStorage.getItem('skillsync_demo_session');
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
    updateAuthState(session);
  } catch (e) {
    console.error('Exception fetching session:', e);
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESH_FAILED') {
      console.warn('Token refresh failed. Showing session expired modal.');
      showSessionExpiredModal();
      return;
    }
    updateAuthState(session);
  });
}

function updateAuthState(session) {
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

function initAuthForm() {
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

  // Instant Quick Demo Login
  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', () => {
      const demoUser = {
        user: {
          id: 'demo-user-123',
          email: 'james@skillsync.demo'
        },
        access_token: 'demo-token-123'
      };
      localStorage.setItem('skillsync_demo_session', JSON.stringify(demoUser));
      updateAuthState(demoUser);
      showToast('Demo session initialized.', 'success');
    });
  }

  if (authSwitchBtn) {
    authSwitchBtn.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
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
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;

      if (!email || !password) return;

      if (authSpinner) authSpinner.classList.remove('hidden');
      if (authSubmitText) authSubmitText.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';

      if (isDemoMode()) {
        setTimeout(() => {
          const demoUser = {
            user: { id: 'demo-' + Date.now(), email },
            access_token: 'demo-token-' + Date.now()
          };
          localStorage.setItem('skillsync_demo_session', JSON.stringify(demoUser));
          updateAuthState(demoUser);
          if (authSpinner) authSpinner.classList.add('hidden');
          if (authSubmitText) authSubmitText.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
          showToast(isSignUpMode ? 'Account created successfully.' : 'Signed in successfully.', 'success');
        }, 300);
        return;
      }

      try {
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
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (isDemoMode()) {
        localStorage.removeItem('skillsync_demo_session');
        updateAuthState(null);
        showToast('Signed out.', 'info');
        return;
      }

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
        showToast('Signed out successfully.', 'info');
      }
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
          email: 'james@skillsync.demo'
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
    resumeText.addEventListener('input', () => updateCharCounter(resumeText, resumeCount, 5000));
  }
  if (jobText && jobCount) {
    jobText.addEventListener('input', () => updateCharCounter(jobText, jobCount, 5000));
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

  if (fullText.length > 5000) {
    fullText = fullText.substring(0, 5000);
    showToast(`PDF extracted! Truncated to 5,000 characters limit (${pdf.numPages} pages).`, 'warning');
  } else {
    showToast(`PDF parsed successfully! (${pdf.numPages} pages)`, 'success');
  }

  if (resumeText) {
    resumeText.value = fullText;
    updateCharCounter(resumeText, resumeCount, 5000);
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

    if (extractedText.length > 5000) {
      extractedText = extractedText.substring(0, 5000);
      showToast('Image transcribed! Truncated to 5,000 character ATS limit.', 'warning');
    } else {
      showToast('Resume image transcribed successfully!', 'success');
    }

    if (resumeText) {
      resumeText.value = extractedText;
      updateCharCounter(resumeText, resumeCount, 5000);
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

  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
  const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || '');

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
  } else {
    showToast('Please upload a PDF document or image file (PNG, JPG, WEBP).', 'error');
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
    if (activeEl && (activeEl.id === 'jobText' || activeEl.id === 'jobUrlInput' || activeEl.id === 'authEmail' || activeEl.id === 'authPassword')) {
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
            jobText.value = sampleJob;
            updateCharCounter(jobText, jobCount, 5000);
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
          jobText.value = data.cleaned_description;
          updateCharCounter(jobText, jobCount, 5000);
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
function calculateDemoMatch(resume, job) {
  const commonSkills = [
    'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Java',
    'Docker', 'Kubernetes', 'AWS', 'GCP', 'PostgreSQL', 'MongoDB', 'Redis',
    'GraphQL', 'Tailwind', 'CI/CD', 'Git', 'Kafka', 'Microservices'
  ];

  const resumeLower = resume.toLowerCase();
  const jobLower = job.toLowerCase();

  const jobSkills = commonSkills.filter(s => jobLower.includes(s.toLowerCase()));
  const targetSkills = jobSkills.length > 0 ? jobSkills : ['Docker', 'Kubernetes', 'TypeScript', 'PostgreSQL', 'GraphQL'];

  const matched = [];
  const missing = [];

  targetSkills.forEach(skill => {
    if (resumeLower.includes(skill.toLowerCase())) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  });

  let score = 50;
  if (targetSkills.length > 0) {
    score = Math.round((matched.length / targetSkills.length) * 100);
    score = Math.max(35, Math.min(95, score));
  }

  // Ensure at least 1 or 2 missing skills for learning demonstration
  if (missing.length === 0) {
    missing.push('Kubernetes', 'Terraform');
  }

  return {
    match_score: score,
    missing_skills: missing
  };
}

function initAnalyzer() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const analyzeBtnText = document.getElementById('analyzeBtnText');
  const analyzeSpinner = document.getElementById('analyzeSpinner');
  const resumeText = document.getElementById('resumeText');
  const jobText = document.getElementById('jobText');
  const resultsSkeleton = document.getElementById('results-skeleton');
  const resultsContainer = document.getElementById('results-container');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      if (!currentSession || !currentSession.access_token) {
        showToast('Please sign in to analyze your resume.', 'warning');
        return;
      }

      const resume = resumeText ? resumeText.value.trim() : '';
      const jobDescription = jobText ? jobText.value.trim() : '';

      if (!resume || !jobDescription) {
        showToast('Please provide both your resume and a target job description.', 'warning');
        return;
      }

      if (resume.length > 5000 || jobDescription.length > 5000) {
        showToast('Inputs must not exceed 5,000 characters each.', 'error');
        return;
      }

      analyzeBtn.disabled = true;
      if (analyzeSpinner) analyzeSpinner.classList.remove('hidden');
      if (analyzeBtnText) analyzeBtnText.textContent = 'Analyzing match...';
      if (resultsSkeleton) resultsSkeleton.classList.remove('hidden');
      if (resultsContainer) resultsContainer.classList.add('hidden');

      // Demo Mode Analysis Simulation
      if (isDemoMode()) {
        setTimeout(() => {
          const matchResult = calculateDemoMatch(resume, jobDescription);

          lastAnalysisResult = {
            match_score: matchResult.match_score,
            missing_skills: matchResult.missing_skills,
            resume_snippet: resume.substring(0, 150),
            job_description: jobDescription.substring(0, 150)
          };

          renderResults(lastAnalysisResult);

          const history = getDemoHistory();
          history.unshift({
            id: 'demo-scan-' + Date.now(),
            user_id: currentSession.user ? currentSession.user.id : 'demo-user',
            resume_snippet: lastAnalysisResult.resume_snippet,
            job_description: lastAnalysisResult.job_description,
            match_score: lastAnalysisResult.match_score,
            missing_skills: lastAnalysisResult.missing_skills,
            created_at: new Date().toISOString()
          });
          saveDemoHistory(history);
          fetchDashboard();

          analyzeBtn.disabled = false;
          if (analyzeSpinner) analyzeSpinner.classList.add('hidden');
          if (analyzeBtnText) analyzeBtnText.textContent = 'Run Match Analysis';
          if (resultsSkeleton) resultsSkeleton.classList.add('hidden');
          showToast('Analysis completed successfully!', 'success');
        }, 900);
        return;
      }

      try {
        // Automatically check and refresh token if Supabase session is close to expiry
        if (supabaseClient && typeof supabaseClient.auth?.getSession === 'function') {
          try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (sessionData && sessionData.session) {
              currentSession = sessionData.session;
            }
          } catch (_) {}
        }

        let response = await fetch('api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({
            resume,
            job_description: jobDescription
          })
        });

        // If 401, attempt silent refresh and retry request once before showing modal
        if (response.status === 401 && supabaseClient && typeof supabaseClient.auth?.refreshSession === 'function') {
          try {
            const { data: refreshedData, error: refreshErr } = await supabaseClient.auth.refreshSession();
            if (!refreshErr && refreshedData && refreshedData.session) {
              currentSession = refreshedData.session;
              response = await fetch('api.php', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${currentSession.access_token}`
                },
                body: JSON.stringify({
                  resume,
                  job_description: jobDescription
                })
              });
            }
          } catch (_) {}
        }

        const data = await response.json();

        if (response.status === 429) {
          showToast(data.message || 'Rate limit exceeded (5 req/min). Please try again shortly.', 'warning', 6000);
          return;
        }

        if (response.status === 401) {
          showSessionExpiredModal();
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || data.error || `HTTP ${response.status}`);
        }

        lastAnalysisResult = {
          match_score: data.match_score,
          missing_skills: data.missing_skills || [],
          resume_snippet: resume.substring(0, 150),
          job_description: jobDescription.substring(0, 150)
        };

        renderResults(lastAnalysisResult);

        if (supabaseClient && currentSession && currentSession.user) {
          const { error: insertError } = await supabaseClient.from('scan_history').insert([
            {
              user_id: currentSession.user.id,
              resume_snippet: lastAnalysisResult.resume_snippet,
              job_description: lastAnalysisResult.job_description,
              match_score: lastAnalysisResult.match_score,
              missing_skills: lastAnalysisResult.missing_skills
            }
          ]);

          if (insertError) {
            console.error('Failed to save scan to Supabase history:', insertError);
          } else {
            fetchDashboard();
          }
        }

        showToast('Analysis completed successfully!', 'success');
      } catch (err) {
        console.error('Analysis error:', err);
        showToast(err.message || 'Failed to complete resume analysis.', 'error');
      } finally {
        analyzeBtn.disabled = false;
        if (analyzeSpinner) analyzeSpinner.classList.add('hidden');
        if (analyzeBtnText) analyzeBtnText.textContent = 'Run Match Analysis';
        if (resultsSkeleton) resultsSkeleton.classList.add('hidden');
      }
    });
  }
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
    scoreBadge.className = `w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-black text-2xl shadow-lg ${colors.badge}`;
  }
  if (scoreNumber) {
    scoreNumber.textContent = `${result.match_score}%`;
  }
  if (scoreFeedback) {
    scoreFeedback.textContent = `${colors.label} • Evaluation against requirements`;
  }

  // Update Multi-Dimensional Breakdown
  const breakdown = result.breakdown || {
    core_tech: Math.min(98, Math.max(30, Math.round(result.match_score * 1.02))),
    devops_cloud: Math.min(95, Math.max(25, Math.round(result.match_score * 0.92))),
    experience_depth: Math.min(96, Math.max(35, Math.round(result.match_score * 0.96))),
    domain_fit: result.match_score
  };

  const coreVal = document.getElementById('breakdownCoreVal');
  const coreBar = document.getElementById('breakdownCoreBar');
  const cloudVal = document.getElementById('breakdownCloudVal');
  const cloudBar = document.getElementById('breakdownCloudBar');
  const expVal = document.getElementById('breakdownExpVal');
  const expBar = document.getElementById('breakdownExpBar');
  const domainVal = document.getElementById('breakdownDomainVal');
  const domainBar = document.getElementById('breakdownDomainBar');

  if (coreVal && coreBar) {
    coreVal.textContent = `${breakdown.core_tech}%`;
    coreBar.style.width = `${breakdown.core_tech}%`;
  }
  if (cloudVal && cloudBar) {
    cloudVal.textContent = `${breakdown.devops_cloud}%`;
    cloudBar.style.width = `${breakdown.devops_cloud}%`;
  }
  if (expVal && expBar) {
    expVal.textContent = `${breakdown.experience_depth}%`;
    expBar.style.width = `${breakdown.experience_depth}%`;
  }
  if (domainVal && domainBar) {
    domainVal.textContent = `${breakdown.domain_fit}%`;
    domainBar.style.width = `${breakdown.domain_fit}%`;
  }

  if (skillsContainer) {
    skillsContainer.innerHTML = '';
    if (!result.missing_skills || result.missing_skills.length === 0) {
      skillsContainer.innerHTML = `
        <span class="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
          <span>No critical skill gaps identified. Strong alignment with requirements.</span>
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
          ' bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700';
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
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        : 'None (Strong Match)';

      const reportText = `SkillSync Match Report\n` +
        `------------------------\n` +
        `Match Compatibility: ${lastAnalysisResult.match_score}%\n` +
        `Identified Skill Gaps: ${skillsText}\n\n` +
        `Generated by SkillSync ATS Console.`;

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

  if (!supabaseClient || !currentSession || !currentSession.user) return;

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

  if (!grid) return;
  grid.innerHTML = '';

  if (!items || items.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

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

  if (!tabAts || !tabDiscovery || !atsView || !discoveryView) return;

  activeWorkspaceTab = tabName;

  const resetBtn = (btn) => {
    if (!btn) return;
    btn.className = 'tab-btn px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-2';
    btn.style.background = 'transparent';
    btn.style.color = 'var(--ink-3)';
  };

  const activateBtn = (btn) => {
    if (!btn) return;
    btn.className = 'tab-btn px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shadow-sm';
    btn.style.background = 'var(--surface)';
    btn.style.color = 'var(--ink)';
  };

  resetBtn(tabAts);
  resetBtn(tabDiscovery);
  resetBtn(tabVault);
  resetBtn(tabPipeline);

  atsView.classList.add('hidden');
  discoveryView.classList.add('hidden');
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
      : FALLBACK_DISCOVERY_JOBS;
  } catch (err) {
    discoveredJobsCache = FALLBACK_DISCOVERY_JOBS.filter(job => {
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
    card.className = 'console-card p-5 sm:p-6 flex flex-col justify-between transition hover:translate-y-[-2px]';
    card.setAttribute('data-job-id', job.id);

    const companyInitial = job.company_name ? job.company_name.charAt(0).toUpperCase() : 'T';
    const comp = job.compatibility;

    const matchedBadges = comp.matchingSkills.length > 0
      ? comp.matchingSkills.map(s => `
          <span class="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>${escapeHtml(s)}</span>
          </span>
        `).join(' ')
      : '';

    const missingBadges = comp.missingSkills.length > 0
      ? comp.missingSkills.slice(0, 3).map(s => `
          <span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-lg opacity-70" style="background: var(--paper-3); color: var(--ink-3); border: 1px solid var(--border);">
            ${escapeHtml(s)}
          </span>
        `).join(' ')
      : '';

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center shrink-0 shadow-sm" style="background: var(--paper-3); color: var(--ink); border: 1px solid var(--border);">
              ${escapeHtml(companyInitial)}
            </div>
            <div>
              <h4 class="font-bold text-sm leading-tight" style="color: var(--ink);">${escapeHtml(job.company_name)}</h4>
              <div class="flex items-center space-x-2 text-[11px] mt-0.5" style="color: var(--ink-3);">
                <span>${escapeHtml(job.location)}</span>
                ${job.remote ? `<span class="px-1.5 py-0.2 rounded font-semibold text-[10px] bg-emerald-500/10 text-emerald-600">Remote</span>` : ''}
              </div>
            </div>
          </div>

          <div class="shrink-0 text-right">
            <span class="px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center space-x-1 ${comp.badgeClass}">
              <span>${comp.score}%</span>
              <span class="opacity-80 font-medium text-[10px]">Fit</span>
            </span>
          </div>
        </div>

        <h3 class="font-bold text-base mb-2" style="color: var(--ink);">${escapeHtml(job.title)}</h3>
        <p class="text-xs line-clamp-2 mb-4 leading-relaxed" style="color: var(--ink-3);">${escapeHtml(job.description)}</p>

        <div class="space-y-1.5 mb-4">
          <div class="text-[10px] uppercase font-bold tracking-wider opacity-60" style="color: var(--ink-4);">ATS Skills Alignment</div>
          <div class="flex flex-wrap gap-1.5 items-center">
            ${matchedBadges}
            ${missingBadges}
          </div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t mt-2" style="border-color: var(--border);">
        <span class="text-xs font-mono font-medium opacity-75" style="color: var(--ink-3);">${escapeHtml(job.salary || 'Competitive')}</span>
        
        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <button type="button" class="btn-track-job flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-xl transition inline-flex items-center space-x-1 hover:bg-slate-500/10" style="background: var(--paper-2); color: var(--sky); border: 1px solid var(--border);">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Track</span>
          </button>
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" class="flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-xl transition inline-flex items-center space-x-1" style="background: var(--paper-2); color: var(--ink); border: 1px solid var(--border);">
            <span>Apply</span>
            <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
          <button type="button" class="btn-load-job flex-1 sm:flex-initial justify-center px-3.5 py-1.5 text-xs font-bold text-white btn-action-primary inline-flex items-center space-x-1.5">
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
      `${job.description}\n\n` +
      `Preferred Skills: ${Array.isArray(job.tags) ? job.tags.join(', ') : 'Tech stack requirements'}`;

    jobText.value = formattedDesc;
    updateCharCounter(jobText, jobCount, 5000);
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

function initJobDiscovery() {
  const tabAts = document.getElementById('tabAtsMatcher');
  const tabDiscovery = document.getElementById('tabJobDiscovery');
  const searchInput = document.getElementById('jobSearchInput');
  const remoteCheckbox = document.getElementById('remoteFilterCheckbox');
  const refreshBtn = document.getElementById('refreshJobsBtn');
  const resumeTextEl = document.getElementById('resumeText');

  if (tabAts) {
    tabAts.addEventListener('click', () => switchWorkspaceTab('ats'));
  }
  if (tabDiscovery) {
    tabDiscovery.addEventListener('click', () => switchWorkspaceTab('discovery'));
  }

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = searchInput.value.trim();
        const remoteOnly = remoteCheckbox ? remoteCheckbox.checked : false;
        fetchAndRenderJobs(query, remoteOnly);
      }, 250);
    });
  }

  if (remoteCheckbox) {
    remoteCheckbox.addEventListener('change', () => {
      const query = searchInput ? searchInput.value.trim() : '';
      fetchAndRenderJobs(query, remoteCheckbox.checked);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const query = searchInput ? searchInput.value.trim() : '';
      const remoteOnly = remoteCheckbox ? remoteCheckbox.checked : false;
      fetchAndRenderJobs(query, remoteOnly);
      showToast('Refreshing live job listings...', 'info', 1500);
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
  const docsListEl = document.getElementById('vaultDocumentsList');
  const countBadge = document.getElementById('vaultDocsCountBadge');
  const totalBadge = document.getElementById('vaultDocTotalBadge');

  if (countBadge) countBadge.textContent = vaultDocumentsCache.length;
  if (totalBadge) totalBadge.textContent = `${vaultDocumentsCache.length} Files`;

  if (docsListEl) {
    docsListEl.innerHTML = '';
    if (vaultDocumentsCache.length === 0) {
      docsListEl.innerHTML = `
        <div class="p-8 text-center border-2 border-dashed rounded-2xl space-y-2" style="border-color: var(--border); color: var(--ink-3);">
          <div class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center opacity-70" style="background: var(--paper-3);">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <p class="text-xs font-semibold" style="color: var(--ink);">No documents stored in vault yet</p>
          <p class="text-[11px] opacity-75">Upload your resume or certificates to extract verified skills.</p>
        </div>
      `;
    } else {
      vaultDocumentsCache.forEach(doc => {
        const docCard = document.createElement('div');
        docCard.className = 'p-3.5 rounded-xl transition space-y-2 border';
        docCard.style.background = 'var(--paper-2)';
        docCard.style.borderColor = 'var(--border)';

        const typeColor = doc.doc_type === 'resume'
          ? 'background: var(--sage-light); color: var(--sage);'
          : (doc.doc_type === 'certification'
            ? 'background: var(--amber-light); color: var(--amber);'
            : 'background: var(--sky-light); color: var(--sky);');

        const skillsPills = (doc.extracted_skills || []).slice(0, 3).map(s => `
          <span class="text-[10px] px-1.5 py-0.5 rounded font-mono opacity-80" style="background: var(--paper-3); color: var(--ink); border: 1px solid var(--border);">
            ${escapeHtml(s)}
          </span>
        `).join(' ');

        docCard.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style="${typeColor}">
                ${escapeHtml(doc.doc_type)}
              </span>
              <h5 class="text-xs font-bold mt-1.5 leading-snug truncate max-w-[190px]" style="color: var(--ink);" title="${escapeHtml(doc.doc_name)}">
                ${escapeHtml(doc.doc_name)}
              </h5>
            </div>
            <button type="button" data-doc-id="${doc.id}" class="btn-delete-vault-doc p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition" title="Delete credential">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <p class="text-[11px] line-clamp-2 opacity-75" style="color: var(--ink-3);">${escapeHtml(doc.content_snippet)}</p>
          <div class="flex flex-wrap gap-1 pt-1">${skillsPills}</div>
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
      ? 'skill-matrix-tile p-3 rounded-2xl border transition group'
      : 'skill-matrix-tile p-2.5 sm:p-3 rounded-2xl border transition group';

    tile.style.background = 'var(--paper-2)';
    tile.style.borderColor = 'var(--border)';
    tile.style.minWidth = isCertCategory ? '150px' : '82px';
    tile.style.maxWidth = isCertCategory ? '240px' : '96px';

    const logoSvg = getSkillLogoSvg(skill, elementId, dotColor);

    tile.innerHTML = `
      <div class="skill-logo-box w-9 h-9 sm:w-10 sm:h-10 rounded-xl mb-2 flex items-center justify-center shadow-xs" style="background: var(--paper-3);">
        ${logoSvg}
      </div>
      <span class="text-[11px] font-bold tracking-tight text-center leading-snug line-clamp-2 w-full" style="color: var(--ink);" title="${escapeHtml(skill)}">
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

  resumeTextEl.value = summary.substring(0, 5000);
  updateCharCounter(resumeTextEl, resumeCount, 5000);

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
          resumeTextEl.value = (resumeTextEl.value.trim() + '\n• ' + b.bullet).substring(0, 5000);
          updateCharCounter(resumeTextEl, resumeCount, 5000);
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

async function openInterviewModal() {
  const modal = document.getElementById('interview-modal');
  const loading = document.getElementById('interviewLoading');
  const list = document.getElementById('interviewQuestionsList');
  const resumeTextEl = document.getElementById('resumeText');
  const jobTextEl = document.getElementById('jobText');

  if (!modal) return;
  modal.classList.remove('hidden');

  const resume = resumeTextEl ? resumeTextEl.value.trim() : '';
  const jobDesc = jobTextEl ? jobTextEl.value.trim() : '';
  const missingSkills = (lastAnalysisResult && Array.isArray(lastAnalysisResult.missing_skills))
    ? lastAnalysisResult.missing_skills
    : [];

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
        resume,
        job_description: jobDesc,
        missing_skills: missingSkills
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate interview prep.');

    lastInterviewQuestions = Array.isArray(data.questions) ? data.questions : [];
    renderInterviewQuestions(lastInterviewQuestions);
  } catch (err) {
    renderInterviewQuestions([
      {
        id: 1,
        category: 'Skill Gap Deep-Dive',
        target_skill: missingSkills[0] || 'System Design',
        question: `How would you architect an idempotent distributed system utilizing ${missingSkills[0] || 'System Design'} under high concurrent load?`,
        interviewer_intent: 'Evaluates production troubleshooting depth and architectural patterns.',
        talking_points: ['Discuss message broker decoupling', 'Explain idempotency keys', 'Outline observability metrics']
      },
      {
        id: 2,
        category: 'Reliability & Scaling',
        target_skill: 'CI/CD & Cloud',
        question: 'When an endpoint suddenly experiences a 10x latency spike in production, what is your step-by-step diagnostic process?',
        interviewer_intent: 'Evaluates production incident triage and systematic root-cause analysis.',
        talking_points: ['Check distributed telemetry traces', 'Inspect database connection pools', 'Review recent deployment diffs']
      }
    ]);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function renderInterviewQuestions(questions) {
  const list = document.getElementById('interviewQuestionsList');
  if (!list) return;

  list.innerHTML = '';
  questions.forEach(q => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl border space-y-2.5 transition hover:border-amber-500/40';
    card.style.background = 'var(--paper-2)';
    card.style.borderColor = 'var(--border)';

    const pointsHtml = Array.isArray(q.talking_points)
      ? q.talking_points.map(pt => `
          <li class="text-xs flex items-start space-x-2" style="color: var(--ink-2);">
            <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>${escapeHtml(pt)}</span>
          </li>
        `).join('')
      : '';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center space-x-1" style="background: var(--paper-3); color: var(--ink);">
          <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <span>${escapeHtml(q.category || 'Technical')}</span>
        </span>
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
      <div class="pt-2 border-t flex items-center justify-end" style="border-color: var(--border);">
        <button type="button" class="btn-copy-single-q px-2.5 py-1 text-[11px] font-semibold rounded-lg transition hover:bg-slate-500/10 inline-flex items-center space-x-1" style="color: var(--ink-2); border: 1px solid var(--border);">
          <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          <span>Copy</span>
        </button>
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
        resumeTextEl.value = (resumeTextEl.value.trim() + '\n\n' + added).substring(0, 5000);
        updateCharCounter(resumeTextEl, resumeCount, 5000);
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
 * 15. Job Application Pipeline Kanban Tracker
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
  } catch (_) {}
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
  showToast(`Moved ${job.title} to ${newStatus.toUpperCase()}.`, 'success');
}

function deletePipelineJob(jobId) {
  pipelineJobs = pipelineJobs.filter(j => j.id !== jobId);
  savePipelineToStorage();
  renderPipeline();
  showToast('Removed role from pipeline.', 'success');
}

function renderPipeline() {
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

  const renderColumn = (container, jobs, stageKey) => {
    container.innerHTML = '';
    if (jobs.length === 0) {
      const stageMeta = {
        saved: {
          icon: '<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>',
          title: 'No saved roles',
          subtitle: 'Track roles from Smart Discovery'
        },
        applied: {
          icon: '<svg class="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>',
          title: 'No applications yet',
          subtitle: 'Move roles here once submitted'
        },
        interviewing: {
          icon: '<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
          title: 'No active interviews',
          subtitle: 'Use AI Prep when scheduled'
        },
        offer: {
          icon: '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>',
          title: 'No offers yet',
          subtitle: 'Your accepted job milestones'
        }
      }[stageKey] || {
        icon: '<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
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
      card.className = 'p-3.5 rounded-xl border space-y-2.5 transition hover:shadow-md';
      card.style.background = 'var(--paper-2)';
      card.style.borderColor = 'var(--border)';

      const colors = getScoreColorClasses(j.score || 70);

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <h5 class="font-bold text-xs leading-snug" style="color: var(--ink);">${escapeHtml(j.title)}</h5>
            <p class="text-[11px] font-medium opacity-80" style="color: var(--ink-3);">${escapeHtml(j.company_name)} • ${escapeHtml(j.location)}</p>
          </div>
          <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ${colors.badge}">
            ${j.score}%
          </span>
        </div>

        <div class="flex items-center justify-between text-[11px] font-mono opacity-70 pt-1" style="color: var(--ink-3);">
          <span>${escapeHtml(j.salary)}</span>
          <span>${escapeHtml(j.created_at)}</span>
        </div>

        <div class="pt-2 border-t flex items-center justify-between gap-1" style="border-color: var(--border);">
          <select class="pipe-status-select console-input text-[10px] px-2 py-1 rounded-lg cursor-pointer">
            <option value="saved" ${j.status === 'saved' ? 'selected' : ''}>Saved</option>
            <option value="applied" ${j.status === 'applied' ? 'selected' : ''}>Applied</option>
            <option value="interviewing" ${j.status === 'interviewing' ? 'selected' : ''}>Interviewing</option>
            <option value="offer" ${j.status === 'offer' ? 'selected' : ''}>Offer</option>
          </select>

          <div class="flex items-center space-x-1">
            <button type="button" class="btn-pipe-salary p-1 rounded-lg hover:bg-slate-500/10 transition" title="Salary Coach & Script" style="color: var(--sage);">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <button type="button" class="btn-pipe-load p-1 rounded-lg hover:bg-slate-500/10 transition" title="Analyze in Workspace" style="color: var(--ink-2);">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
            <button type="button" class="btn-pipe-delete p-1 rounded-lg hover:bg-rose-500/10 text-rose-500 transition" title="Delete">
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

      const salaryCardBtn = card.querySelector('.btn-pipe-salary');
      if (salaryCardBtn) {
        salaryCardBtn.addEventListener('click', () => {
          openSalaryModal(j);
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

  const tabPipeline = document.getElementById('tabPipeline');
  if (tabPipeline) {
    tabPipeline.addEventListener('click', () => switchWorkspaceTab('pipeline'));
  }

  const addBtn = document.getElementById('addPipelineJobBtn');
  const addModal = document.getElementById('add-pipeline-modal');
  const closeBtn = document.getElementById('closeAddPipelineModalBtn');
  const cancelBtn = document.getElementById('cancelAddPipelineBtn');
  const form = document.getElementById('addPipelineForm');

  if (addBtn && addModal) {
    addBtn.addEventListener('click', () => addModal.classList.remove('hidden'));
  }

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

      addJobToPipeline({
        id: `pipe-${Date.now()}`,
        title,
        company_name: company,
        location,
        salary,
        url,
        score: 80,
        status,
        created_at: new Date().toISOString().split('T')[0]
      }, status);

      form.reset();
      closeAddModal();
    });
  }

  renderPipeline();
}

/**
 * 16. Main Application Initialization
 */
function initApp() {
  if (!checkCdn()) return;

  initTheme();
  initSupabase();
  initAuth();
  initAuthForm();
  initCharCounters();
  initPdfUpload();
  initJobScraper();
  initAnalyzer();
  initExportAndClipboard();
  initModals();
  initJobDiscovery();
  initSkillVault();
  initAiActionSuite();
  initPipeline();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
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
    fetchAndRenderJobs,
    recomputeAndRenderJobCards,
    initJobDiscovery,
    setJobsPage,
    getPaginationState,
    JOBS_PER_PAGE,
    FALLBACK_DISCOVERY_JOBS,
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
    addJobToPipeline,
    updatePipelineJobStatus,
    deletePipelineJob,
    renderPipeline,
    initPipeline,
    getPipelineJobs: () => pipelineJobs,
    setPipelineJobs: (jobs) => { pipelineJobs = jobs; },
    initApp
  };
}
