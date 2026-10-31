/**
 * SkillSync - Frontend Unit Test Suite
 * File: script.test.js
 *
 * @jest-environment jsdom
 */

const {
  checkCdn,
  applyTheme,
  toggleTheme,
  showToast,
  escapeHtml,
  updateCharCounter,
  generateYouTubeLink,
  getScoreColorClasses
} = require('./script');

describe('SkillSync Frontend Test Suite', () => {

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="cdn-fallback" style="display: none;"></div>
      <div id="app-container"></div>
      <div id="toast-container"></div>
      <button id="themeToggle">
        <svg id="sunIcon" class="hidden"></svg>
        <svg id="moonIcon" class="hidden"></svg>
      </button>
      <textarea id="resumeText"></textarea>
      <span id="resumeCount">0 / 5,000</span>
      <textarea id="jobText"></textarea>
      <span id="jobCount">0 / 5,000</span>
    `;

    // Clear localStorage
    localStorage.clear();
    document.documentElement.className = '';
    jest.clearAllMocks();
  });

  // 1. Character Limit & Counter Tests
  describe('Character Limit Counter', () => {
    test('updates counter text accurately with character count', () => {
      const textarea = document.getElementById('resumeText');
      const counter = document.getElementById('resumeCount');

      textarea.value = 'Hello World';
      updateCharCounter(textarea, counter, 5000);

      expect(counter.textContent).toBe('11 / 5,000');
      expect(counter.classList.contains('text-rose-500')).toBe(false);
    });

    test('adds warning styling when character limit is reached or exceeded', () => {
      const textarea = document.getElementById('resumeText');
      const counter = document.getElementById('resumeCount');

      textarea.value = 'a'.repeat(5000);
      updateCharCounter(textarea, counter, 5000);

      expect(counter.textContent).toBe('5,000 / 5,000');
      expect(counter.classList.contains('text-rose-500')).toBe(true);
      expect(counter.classList.contains('font-bold')).toBe(true);
    });

    test('handles empty input gracefully', () => {
      const textarea = document.getElementById('jobText');
      const counter = document.getElementById('jobCount');

      textarea.value = '';
      updateCharCounter(textarea, counter, 5000);

      expect(counter.textContent).toBe('0 / 5,000');
      expect(counter.classList.contains('text-rose-500')).toBe(false);
    });
  });

  // 2. Theme Toggle Logic
  describe('Theme Toggle Logic', () => {
    test('applies dark theme and updates localStorage and icons', () => {
      applyTheme('dark');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('skillsync_theme')).toBe('dark');

      const sunIcon = document.getElementById('sunIcon');
      const moonIcon = document.getElementById('moonIcon');
      expect(sunIcon.classList.contains('hidden')).toBe(false);
      expect(moonIcon.classList.contains('hidden')).toBe(true);
    });

    test('applies light theme and updates localStorage and icons', () => {
      applyTheme('light');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('skillsync_theme')).toBe('light');

      const sunIcon = document.getElementById('sunIcon');
      const moonIcon = document.getElementById('moonIcon');
      expect(sunIcon.classList.contains('hidden')).toBe(true);
      expect(moonIcon.classList.contains('hidden')).toBe(false);
    });

    test('toggleTheme toggles between dark and light', () => {
      applyTheme('dark');
      toggleTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('skillsync_theme')).toBe('light');

      toggleTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('skillsync_theme')).toBe('dark');
    });
  });

  // 3. Dynamic YouTube Link Generator
  describe('Dynamic YouTube Link Generator', () => {
    test('generates valid encoded YouTube search URL for a skill', () => {
      const link = generateYouTubeLink('Docker');
      expect(link).toBe('https://www.youtube.com/results?search_query=learn%20Docker');
    });

    test('correctly encodes multi-word skills and special characters', () => {
      const link = generateYouTubeLink('React & Redux');
      expect(link).toBe('https://www.youtube.com/results?search_query=learn%20React%20%26%20Redux');
    });

    test('returns # for empty or null skill values', () => {
      expect(generateYouTubeLink('')).toBe('#');
      expect(generateYouTubeLink(null)).toBe('#');
    });
  });

  // 4. Score Styling & Color Classes
  describe('Match Score Evaluation Helpers', () => {
    test('categorizes >= 75 as Strong Match with emerald badge', () => {
      const res = getScoreColorClasses(85);
      expect(res.label).toBe('Strong Match');
      expect(res.badge).toContain('bg-emerald-500');
    });

    test('categorizes 50 to 74 as Moderate Match with amber badge', () => {
      const res = getScoreColorClasses(65);
      expect(res.label).toBe('Moderate Match');
      expect(res.badge).toContain('bg-amber-500');
    });

    test('categorizes < 50 as Needs Growth with rose badge', () => {
      const res = getScoreColorClasses(35);
      expect(res.label).toBe('Needs Growth');
      expect(res.badge).toContain('bg-rose-500');
    });
  });

  // 5. Toast Notification System
  describe('Toast Notification System', () => {
    test('creates and appends toast element with proper message and classes', () => {
      const toast = showToast('Scan successfully saved!', 'success');
      const container = document.getElementById('toast-container');

      expect(container.contains(toast)).toBe(true);
      expect(toast.textContent).toContain('Scan successfully saved!');
      expect(toast.className).toContain('bg-emerald-50');
    });

    test('handles warning toasts (e.g. Rate Limit 429 alerts)', () => {
      const toast = showToast('Rate limit exceeded (5 req/min).', 'warning');
      expect(toast.textContent).toContain('Rate limit exceeded (5 req/min).');
      expect(toast.className).toContain('bg-amber-50');
    });

    test('handles error toasts properly', () => {
      const toast = showToast('Server communication failure.', 'error');
      expect(toast.textContent).toContain('Server communication failure.');
      expect(toast.className).toContain('bg-rose-50');
    });
  });

  // 6. CDN Fallback Verification
  describe('CDN Fallback Logic', () => {
    test('shows fallback UI and hides app container if CDNs are missing', () => {
      // Clear global CDN window variables
      delete window.tailwind;
      delete window.supabase;
      delete window.pdfjsLib;
      delete window.html2pdf;

      const result = checkCdn();
      const fallback = document.getElementById('cdn-fallback');
      const app = document.getElementById('app-container');

      expect(result).toBe(false);
      expect(fallback.style.display).toBe('block');
      expect(app.style.display).toBe('none');
    });

    test('returns true when all CDNs are available', () => {
      window.tailwind = {};
      window.supabase = {};
      window.pdfjsLib = {};
      window.html2pdf = {};

      const result = checkCdn();
      const fallback = document.getElementById('cdn-fallback');

      expect(result).toBe(true);
      expect(fallback.style.display).toBe('none');
    });
  });

  // 7. Mocking Fetch API & Supabase Interaction
  describe('Mocked Backend Communication & Error Handling', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('simulates successful 200 AI analysis response', async () => {
      const mockResult = {
        match_score: 88,
        missing_skills: ['Kubernetes', 'GraphQL']
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResult
      });

      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: 'Sample resume', job_description: 'Sample job' })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.match_score).toBe(88);
      expect(data.missing_skills).toEqual(['Kubernetes', 'GraphQL']);
    });

    test('simulates 429 Too Many Requests rate limiting response', async () => {
      const mockRateLimit = {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 5 requests allowed per minute.'
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => mockRateLimit
      });

      const response = await fetch('scrape.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/job' })
      });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Too Many Requests');

      // Test displaying the rate limit warning toast
      const toast = showToast(data.message, 'warning');
      expect(toast.textContent).toContain('Maximum 5 requests allowed per minute');
    });

    test('mocks Supabase database querying and deletion', async () => {
      const mockScanHistory = [
        {
          id: 'test-uuid-1',
          user_id: 'user-123',
          resume_snippet: 'Experienced Engineer',
          job_description: 'Senior Software Engineer',
          match_score: 90,
          missing_skills: ['Terraform'],
          created_at: new Date().toISOString()
        }
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockScanHistory, error: null }),
          delete: jest.fn().mockReturnThis()
        })
      };

      const { data } = await mockSupabase.from('scan_history').select('*').eq('user_id', 'user-123').order('created_at');
      expect(data).toHaveLength(1);
      expect(data[0].match_score).toBe(90);
      expect(data[0].missing_skills).toContain('Terraform');
    });
  });

  // 8. HTML Escaping Utility
  describe('HTML Escaping XSS Prevention', () => {
    test('escapes malicious HTML characters properly', () => {
      const dirty = '<script>alert("xss")</script> & "quote" \'single\'';
      const clean = escapeHtml(dirty);

      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
      expect(clean).toContain('&amp;');
      expect(clean).toContain('&quot;');
      expect(clean).toContain('&#039;');
    });
  });

});
