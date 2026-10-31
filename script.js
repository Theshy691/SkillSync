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
        const response = await fetch('scrape.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({ url })
        });

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
        const response = await fetch('api.php', {
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
    scoreFeedback.textContent = `${colors.label} - Evaluated against target requirements`;
  }

  if (skillsContainer) {
    skillsContainer.innerHTML = '';
    if (!result.missing_skills || result.missing_skills.length === 0) {
      skillsContainer.innerHTML = `
        <span class="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200">
          🎉 No critical missing skills detected! Excellent match.
        </span>
      `;
    } else {
      result.missing_skills.forEach(skill => {
        const youtubeUrl = generateYouTubeLink(skill);
        const a = document.createElement('a');
        a.href = youtubeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'group inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 transition shadow-sm';
        a.innerHTML = `
          <svg class="w-3.5 h-3.5 text-red-500 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span>${escapeHtml(skill)}</span>
          <svg class="w-3 h-3 text-slate-400 group-hover:text-red-500 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        `;
        skillsContainer.appendChild(a);
      });
    }
  }

  resultsContainer.classList.remove('hidden');
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        `Generated by SkillSync AI Matcher.`;

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
      <a href="${generateYouTubeLink(skill)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg transition" style="background: var(--paper-3); color: var(--ink); border: 1px solid var(--border);">
        ${escapeHtml(skill)}
      </a>
    `).join(' ') + (skills.length > 3 ? `<span class="text-[10px] opacity-60" style="color: var(--ink-4);">+${skills.length - 3} more</span>` : '');

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-2.5 py-1 rounded-xl text-xs font-bold ${colors.badge}">
            ${item.match_score}% Match
          </span>
          <span class="text-[11px] font-mono opacity-65" style="color: var(--ink-4);">${dateFormatted}</span>
        </div>
        <div class="space-y-2 mb-4">
          <div>
            <div class="text-[10px] uppercase font-bold tracking-wider" style="color: var(--ink-4);">Target Role Snippet</div>
            <p class="text-xs line-clamp-2" style="color: var(--ink-2);">${escapeHtml(item.job_description)}</p>
          </div>
          <div>
            <div class="text-[10px] uppercase font-bold tracking-wider" style="color: var(--ink-4);">Resume Extract</div>
            <p class="text-xs line-clamp-2" style="color: var(--ink-3);">${escapeHtml(item.resume_snippet)}</p>
          </div>
        </div>
      </div>
      <div>
        <div class="flex flex-wrap gap-1.5 items-center mb-3">
          ${skillsHtml}
        </div>
        <div class="flex items-center justify-between pt-3 border-t" style="border-color: var(--border);">
          <button data-id="${item.id}" class="delete-history-btn inline-flex items-center space-x-1 text-xs font-semibold text-rose-500 hover:text-rose-600 transition">
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
 * 14. Main Application Initialization
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
    initApp
  };
}
