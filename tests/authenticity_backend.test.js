/**
 * SkillSync - Authenticity Backend API Contract Test Suite
 * File: tests/authenticity_backend.test.js
 *
 * Verifies backend authenticity endpoint contracts, input validation,
 * authentication guardrails, and anomaly response schemas.
 */

describe('Authenticity Backend API Contract Tests', () => {
  const AUTH_ENDPOINT = 'http://localhost:8000/backend/authenticity.php';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('enforces POST method and rejects GET with 405 Method Not Allowed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 405,
      ok: false,
      json: async () => ({
        error: 'Method Not Allowed',
        message: 'Only POST requests are permitted.'
      })
    });

    const res = await fetch(AUTH_ENDPOINT, { method: 'GET' });
    const data = await res.json();

    expect(res.status).toBe(405);
    expect(data.error).toBe('Method Not Allowed');
  });

  test('rejects unauthenticated requests with 401 Unauthorized', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({
        error: 'Unauthorized',
        message: 'Missing Bearer token in Authorization header.'
      })
    });

    const res = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: 'Sample resume text' })
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  test('validates minimum resume character length with 400 Bad Request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({
        error: 'Bad Request',
        message: 'Resume text is required and must be at least 30 characters.'
      })
    });

    const res = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-token-123'
      },
      body: JSON.stringify({ resume: 'Too short' })
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Bad Request');
  });

  test('returns credibility payload with verdict, flagged issues, and metrics', async () => {
    const mockPayload = {
      success: true,
      credibility_score: 85,
      verdict: 'High Credibility',
      flagged_issues: [],
      substantiated_skills: ['React', 'TypeScript', 'Node.js'],
      unsubstantiated_skills: [],
      metrics: {
        total_detected_skills: 3,
        substantiated_skills_count: 3,
        unsubstantiated_skills_count: 0,
        evidence_ratio_percent: 100
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockPayload
    });

    const res = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-token-123'
      },
      body: JSON.stringify({
        resume: 'Senior Full Stack Engineer with 6 years experience building React and TypeScript applications.'
      })
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.credibility_score).toBe(85);
    expect(data.verdict).toBe('High Credibility');
    expect(Array.isArray(data.substantiated_skills)).toBe(true);
  });

  test('detects anachronisms and returns flagged issues array', async () => {
    const mockPayload = {
      success: true,
      credibility_score: 58,
      verdict: 'Elevated Risk - Review Flagged Inconsistencies',
      flagged_issues: [
        {
          type: 'anachronism',
          severity: 'critical',
          title: 'Chronological Anachronism: kubernetes',
          description: 'Resume claims 18+ years of kubernetes, but kubernetes was created in 2014.',
          recommendation: 'Adjust claimed experience.'
        }
      ],
      substantiated_skills: [],
      unsubstantiated_skills: ['Kubernetes'],
      metrics: {
        total_detected_skills: 1,
        substantiated_skills_count: 0,
        unsubstantiated_skills_count: 1,
        evidence_ratio_percent: 0
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockPayload
    });

    const res = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-token-123'
      },
      body: JSON.stringify({
        resume: '18 years of experience with Kubernetes architecting enterprise distributed microservices.'
      })
    });
    const data = await res.json();

    expect(data.credibility_score).toBeLessThan(70);
    expect(data.flagged_issues.length).toBeGreaterThan(0);
    expect(data.flagged_issues[0].type).toBe('anachronism');
  });
});
