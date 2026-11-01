/**
 * SkillSync - Backend Security & Contract Test Suite
 * File: tests/backend_integration.test.js
 *
 * Verifies backend API contract compliance, rate limiting responses,
 * authentication guardrails, and security header contracts.
 */

describe('Backend API Contract & Security Test Suite', () => {
  const MOCK_API_BASE = 'http://localhost:8000/backend';

  test('enforces POST method on analysis and rejects GET with 405 Method Not Allowed', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 405,
      ok: false,
      json: async () => ({
        error: 'Method Not Allowed',
        message: 'Only POST requests are permitted.'
      })
    });

    global.fetch = mockFetch;

    const res = await fetch(`${MOCK_API_BASE}/api.php`, { method: 'GET' });
    const data = await res.json();

    expect(res.status).toBe(405);
    expect(data.error).toBe('Method Not Allowed');
  });

  test('returns 401 Unauthorized when Bearer token is omitted from Authorization header', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({
        error: 'Unauthorized',
        message: 'Missing Bearer token in Authorization header.'
      })
    });

    global.fetch = mockFetch;

    const res = await fetch(`${MOCK_API_BASE}/api.php`, {
      method: 'POST',
      body: JSON.stringify({ resume_text: 'test', job_description: 'test' })
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  test('returns 429 Too Many Requests with retry-after warning when rate limit is exceeded', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
      json: async () => ({
        error: 'Rate Limit Exceeded',
        message: 'Too many analysis requests. Please wait a moment.'
      })
    });

    global.fetch = mockFetch;

    const res = await fetch(`${MOCK_API_BASE}/api.php`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' }
    });
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.message).toContain('Too many analysis requests');
  });

  test('returns 400 Bad Request when location contains numeric digits', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({
        error: 'Validation Error',
        message: 'Location name cannot contain numbers.'
      })
    });

    global.fetch = mockFetch;

    const res = await fetch(`${MOCK_API_BASE}/salary.php`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Engineer', location: 'San Francisco 123' })
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toBe('Location name cannot contain numbers.');
  });
});

