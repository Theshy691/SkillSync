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
    scoreFeedback.textContent = `${colors.label} • Evaluation against requirements`;
  }

  if (skillsContainer) {
    skillsContainer.innerHTML = '';
    if (!result.missing_skills || result.missing_skills.length === 0) {
      skillsContainer.innerHTML = `
        <span class="text-xs font-medium px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          No critical skill gaps identified. Strong alignment with requirements.
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
      <a href="${generateYouTubeLink(skill)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg transition" style="background: var(--paper-3); color: var(--ink); border: 1px solid var(--border);">
        ${escapeHtml(skill)}
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
  const atsView = document.getElementById('ats-view');
  const discoveryView = document.getElementById('discovery-view');
  const vaultView = document.getElementById('vault-view');

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

  atsView.classList.add('hidden');
  discoveryView.classList.add('hidden');
  if (vaultView) vaultView.classList.add('hidden');

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

    const res = await fetch(`jobs.php?${params.toString()}`);
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
      scoringStatusText.textContent = 'Scoring live postings against your uploaded resume.';
    } else if (typeof getAllVaultSkills === 'function' && getAllVaultSkills().length > 0) {
      scoringStatusText.textContent = `Scoring live postings against ${vaultDocumentsCache.length} verified documents in your Skill Vault.`;
    } else {
      scoringStatusText.textContent = 'Using baseline developer profile (upload your resume for custom match scores).';
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

      <div class="flex items-center justify-between pt-3.5 border-t mt-2" style="border-color: var(--border);">
        <span class="text-xs font-mono font-medium opacity-75" style="color: var(--ink-3);">${escapeHtml(job.salary || 'Competitive')}</span>
        
        <div class="flex items-center space-x-2">
          <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 text-xs font-semibold rounded-xl transition inline-flex items-center space-x-1" style="background: var(--paper-2); color: var(--ink); border: 1px solid var(--border);">
            <span>Apply</span>
            <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
          <button type="button" class="btn-load-job px-3.5 py-1.5 text-xs font-bold text-white btn-action-primary inline-flex items-center space-x-1.5">
            <span>Analyze in Workspace</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </div>
    `;

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
        <div class="p-6 text-center border-dashed rounded-xl" style="border: 1px dashed var(--border); color: var(--ink-4);">
          <p class="text-xs">No documents stored in vault yet.</p>
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

function renderMatrixCategory(elementId, items, dotColor) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = '<span class="text-xs opacity-50" style="color: var(--ink-4);">No verified credentials detected in this category.</span>';
    return;
  }

  items.forEach(skill => {
    const pill = document.createElement('span');
    pill.className = 'inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-xs';
    pill.style.background = 'var(--paper-2)';
    pill.style.color = 'var(--ink)';
    pill.style.border = '1px solid var(--border)';
    pill.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full" style="background: ${dotColor};"></span>
      <span>${escapeHtml(skill)}</span>
    `;
    container.appendChild(pill);
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
  initJobDiscovery();
  initSkillVault();
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
    renderVaultUI,
    addDocumentToVault,
    deleteVaultDocument,
    syncVaultToWorkspace,
    initSkillVault,
    getVaultDocumentsCache: () => vaultDocumentsCache,
    getVerifiedSkillsMatrix: () => verifiedSkillsMatrix,
    initApp
  };
}
