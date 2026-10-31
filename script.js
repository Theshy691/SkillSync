/**
 * SkillSync - Full-Stack AI Resume & Skill Matcher
 * File: script.js
 *
 * Handles client-side UI, CDN checks, dark/light theme toggle, toast notifications,
 * Supabase auth & session persistence, client-side PDF parsing (PDF.js),
 * AI web scraper proxying (scrape.php), AI resume matching (api.php),
 * dynamic scan history dashboard with sorting & deletion, PDF export (html2pdf),
 * and clipboard copying.
 */

// Global State
let supabaseClient = null;
let currentSession = null;
let pendingDeleteId = null;
let lastAnalysisResult = null;

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

  if (theme === 'dark') {
    html.classList.add('dark');
    localStorage.setItem('skillsync_theme', 'dark');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  } else {
    html.classList.remove('dark');
    localStorage.setItem('skillsync_theme', 'light');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
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
 * Types: 'success', 'error', 'warning', 'info'
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
  const cfg = window.SKILLSYNC_CONFIG || {};
  const supabaseUrl = cfg.SUPABASE_URL;
  const supabaseAnonKey = cfg.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
    console.warn('SkillSync: Supabase credentials not set in config.js.');
    showToast('Please set your SUPABASE_URL and SUPABASE_ANON_KEY in config.js', 'warning', 8000);
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
    showToast('Failed to initialize Supabase client.', 'error');
    return null;
  }
}

async function initAuth() {
  if (!supabaseClient) return;

  // Retrieve current session
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('Error checking session:', error);
    }
    updateAuthState(session);
  } catch (e) {
    console.error('Exception fetching session:', e);
  }

  // Listen to auth events
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
    if (userEmailBadge) userEmailBadge.textContent = session.user.email || 'Authenticated';

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
 * 6. Auth Form Handlers (Sign In & Sign Up)
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

  if (authSwitchBtn) {
    authSwitchBtn.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      if (isSignUpMode) {
        authTitle.textContent = 'Create an Account';
        authSubtitle.textContent = 'Sign up to analyze and track your resume scans';
        authSubmitText.textContent = 'Sign Up';
        authSwitchPrompt.textContent = 'Already have an account?';
        authSwitchBtn.textContent = 'Sign in';
      } else {
        authTitle.textContent = 'Welcome to SkillSync';
        authSubtitle.textContent = 'Sign in to match your resume with AI precision';
        authSubmitText.textContent = 'Sign In';
        authSwitchPrompt.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Create one now';
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabaseClient) {
        showToast('Supabase client is not configured. Check config.js.', 'error');
        return;
      }

      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;

      if (!email || !password) return;

      if (authSpinner) authSpinner.classList.remove('hidden');
      if (authSubmitText) authSubmitText.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';

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
 * 8. PDF Extraction Logic (pdf.js)
 */
function initPdfUpload() {
  const resumeFileInput = document.getElementById('resumeFileInput');
  const uploadPdfBtn = document.getElementById('uploadPdfBtn');
  const resumeText = document.getElementById('resumeText');
  const resumeCount = document.getElementById('resumeCount');

  if (uploadPdfBtn && resumeFileInput) {
    uploadPdfBtn.addEventListener('click', () => {
      resumeFileInput.click();
    });
  }

  if (resumeFileInput) {
    resumeFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please select a valid PDF file.', 'error');
        return;
      }

      showToast('Extracting text from PDF...', 'info', 2000);

      try {
        if (typeof pdfjsLib === 'undefined') {
          throw new Error('PDF.js library is not available.');
        }

        // Configure PDF.js worker
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
      } catch (err) {
        console.error('PDF parsing error:', err);
        showToast('Failed to parse PDF: ' + (err.message || 'Unknown error'), 'error');
      } finally {
        resumeFileInput.value = '';
      }
    });
  }
}

/**
 * 9. AI-Powered Job URL Scraper & Cache (scrape.php)
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

      // UI Loading state
      scrapeBtn.disabled = true;
      if (scrapeSpinner) scrapeSpinner.classList.remove('hidden');
      if (scrapeBtnText) scrapeBtnText.textContent = 'Scraping...';

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
            ? '⚡ Loaded from Supabase cache'
            : '✨ Freshly scraped & summarized by Gemini AI';
        }

        showToast(
          data.source === 'cache' ? 'Job loaded from database cache!' : 'Job scraped & cleaned by Gemini AI!',
          'success'
        );
      } catch (err) {
        console.error('Job scrape error:', err);
        showToast(err.message || 'Failed to scrape job URL.', 'error');
      } finally {
        scrapeBtn.disabled = false;
        if (scrapeSpinner) scrapeSpinner.classList.add('hidden');
        if (scrapeBtnText) scrapeBtnText.textContent = 'Fetch & Clean';
      }
    });
  }
}

/**
 * 10. AI Resume & Skill Gap Analysis (api.php)
 */
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

      // Enter Loading State
      analyzeBtn.disabled = true;
      if (analyzeSpinner) analyzeSpinner.classList.remove('hidden');
      if (analyzeBtnText) analyzeBtnText.textContent = 'Analyzing with Gemini AI...';
      if (resultsSkeleton) resultsSkeleton.classList.remove('hidden');
      if (resultsContainer) resultsContainer.classList.add('hidden');

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

        // Render Results UI
        renderResults(lastAnalysisResult);

        // Save scan record to Supabase scan_history
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
        if (analyzeBtnText) analyzeBtnText.textContent = 'Analyze Match & Skill Gaps';
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

  // Render Missing Skills as Clickable YouTube Links
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
          <!-- YouTube Icon -->
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
  if (!supabaseClient || !currentSession || !currentSession.user) return;

  const sortSelect = document.getElementById('sortDashboard');
  const sortValue = sortSelect ? sortSelect.value : 'newest';

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
    card.className = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between';

    const colors = getScoreColorClasses(item.match_score);
    const dateFormatted = new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const skills = Array.isArray(item.missing_skills) ? item.missing_skills : [];
    const skillsHtml = skills.slice(0, 3).map(skill => `
      <a href="${generateYouTubeLink(skill)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-red-500">
        ${escapeHtml(skill)}
      </a>
    `).join(' ') + (skills.length > 3 ? `<span class="text-[10px] text-slate-400">+${skills.length - 3} more</span>` : '');

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-2.5 py-1 rounded-xl text-xs font-bold ${colors.badge}">
            ${item.match_score}% Match
          </span>
          <span class="text-[11px] text-slate-400 font-mono">${dateFormatted}</span>
        </div>
        <div class="space-y-2 mb-4">
          <div>
            <div class="text-[10px] uppercase font-bold text-slate-400">Target Role Snippet</div>
            <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">${escapeHtml(item.job_description)}</p>
          </div>
          <div>
            <div class="text-[10px] uppercase font-bold text-slate-400">Resume Extract</div>
            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${escapeHtml(item.resume_snippet)}</p>
          </div>
        </div>
      </div>
      <div>
        <div class="flex flex-wrap gap-1.5 items-center mb-3">
          ${skillsHtml}
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button data-id="${item.id}" class="delete-history-btn inline-flex items-center space-x-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Attach single-record delete listeners
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
  // Delete Single Modal
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
      if (!pendingDeleteId || !supabaseClient) return;

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

  // Clear All Modal
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

  // Dashboard Sorting Change
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

// Auto-run when DOM is fully loaded in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}

// Export for Node/Jest testing environment
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
    initApp
  };
}
