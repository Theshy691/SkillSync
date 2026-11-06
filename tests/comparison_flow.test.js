/** @jest-environment jsdom */
const fs = require('fs');
const vm = require('vm');
const { calculateDemoMatch, normalizeMatchResult } = require('../script');

test('keyword coverage counts aliases once and keeps unrelated language names separate', () => {
  expect(calculateDemoMatch('Node.js PostgreSQL K8s', 'Node Postgres Kubernetes').match_score).toBe(100);
  expect(calculateDemoMatch('C++ JavaScript', 'C# Java').match_score).toBe(0);
  expect(calculateDemoMatch('Node.js', 'Node.js and Node').matched_skills).toEqual(['Node.js']);
});

test('incomplete and invalid service scores cannot render as successful comparisons', () => {
  [null, {}, { match_score: '85' }, { match_score: NaN }, { match_score: 101 }].forEach(data => {
    expect(() => normalizeMatchResult(data)).toThrow();
  });
  expect(normalizeMatchResult({ match_score: 0, missing_skills: [' Docker ', 'Docker', null], breakdown: { core_tech: 0, domain_fit: 120 } }))
    .toMatchObject({ match_score: 0, missing_skills: ['Docker'], breakdown: { core_tech: 0 } });
});

function setup(fetch) {
  document.body.innerHTML = `<button id="analyzeBtn"><span id="analyzeBtnText"></span></button>
    <textarea id="resumeText">React developer experience</textarea><textarea id="jobText">React Docker requirements</textarea>
    <p id="resumeError"></p><p id="jobError"></p><p id="analysisError" class="hidden"></p>
    <p id="comparisonReadiness"></p><div id="results-skeleton" class="hidden"></div>
    <div id="results-container" class="hidden"><span id="scoreNumber"></span><span id="scoreSource"></span></div>
    <p id="resultsStale" class="hidden"></p><button id="tailorResumeBtn"></button><span id="scoringEngineIndicator"></span>`;
  localStorage.clear(); sessionStorage.clear();
  const context = { document, Event, localStorage, sessionStorage, AbortController, URLSearchParams, fetch,
    console: { error() {}, warn() {}, info() {} }, setTimeout, clearTimeout };
  context.window = context;
  context.SKILLSYNC_CONFIG = { SUPABASE_URL: 'https://example.supabase.co' };
  context.matchMedia = () => ({ matches: true });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../script.js'), 'utf8'), context);
  vm.runInContext("currentSession = {user:{id:'test-user'},access_token:'test-token'}; supabaseClient = {}; initAnalyzer();", context);
  return context;
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('failed service requests preserve documents, show a retry message, and release the button', async () => {
  setup(jest.fn().mockRejectedValue(new Error('Network unavailable. Try again.')));
  document.getElementById('analyzeBtn').click();
  await settle();
  expect(document.getElementById('resumeText').value).toBe('React developer experience');
  expect(document.getElementById('analysisError').textContent).toContain('Try again');
  expect(document.getElementById('analyzeBtn').disabled).toBe(false);
  expect(document.getElementById('results-skeleton').classList.contains('hidden')).toBe(true);
});

test('loading placeholder is removed before scrolling to the completed report', async () => {
  setup(async () => ({ ok: true, status: 200, json: async () => ({ match_score: 50, missing_skills: ['Docker'], source: 'ai' }) }));
  const report = document.getElementById('results-container');
  report.scrollIntoView = jest.fn(() => {
    expect(document.getElementById('results-skeleton').classList.contains('hidden')).toBe(true);
  });
  document.getElementById('analyzeBtn').click();
  await settle();
  expect(report.scrollIntoView).toHaveBeenCalled();
});

test('editing documents during a request marks the returned report as stale', async () => {
  let finish;
  setup(() => new Promise(resolve => { finish = resolve; }));
  document.getElementById('analyzeBtn').click();
  document.getElementById('resumeText').value = 'Different resume';
  document.getElementById('resumeText').dispatchEvent(new Event('input'));
  finish({ ok: true, status: 200, json: async () => ({ match_score: 50, missing_skills: ['Docker'], source: 'ai' }) });
  await settle();
  expect(document.getElementById('resultsStale').classList.contains('hidden')).toBe(false);
  expect(document.getElementById('tailorResumeBtn').disabled).toBe(true);
});

test('rate limits do not report comparison complete', async () => {
  setup(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  document.getElementById('analyzeBtn').click();
  await settle();
  expect(document.getElementById('analysisError').textContent).toContain('one minute');
  expect(document.getElementById('scoringEngineIndicator').textContent).toBe('Comparison needs a retry');
});

test('a delayed cloud auth event cannot close an explicitly selected demo', async () => {
  const context = setup(jest.fn());
  let authEvent;
  context.authMock = { auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: callback => { authEvent = callback; }
  } };
  vm.runInContext('supabaseClient = authMock;', context);
  await context.initAuth();
  localStorage.setItem('skillsync_demo_session', JSON.stringify({ access_token: 'demo-token-123' }));
  vm.runInContext("currentSession = {user:{id:'demo-user'},access_token:'demo-token-123'};", context);
  authEvent('INITIAL_SESSION', null);
  expect(vm.runInContext('currentSession.user.id', context)).toBe('demo-user');
});

test('timeout aborts a stalled request and keeps the draft available', async () => {
  jest.useFakeTimers();
  try {
    setup((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('Aborted'); error.name = 'AbortError'; reject(error);
    })));
    document.getElementById('analyzeBtn').click();
    jest.advanceTimersByTime(45000);
    await settle();
    expect(document.getElementById('analysisError').textContent).toContain('took too long');
    expect(document.getElementById('analyzeBtn').disabled).toBe(false);
    expect(document.getElementById('resumeText').value).toBe('React developer experience');
  } finally { jest.useRealTimers(); }
});
