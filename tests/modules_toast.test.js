/**
 * SkillSync - Standalone Toast Module Test Suite
 * File: tests/modules_toast.test.js
 *
 * @jest-environment jsdom
 */

const {
  escapeToastText,
  getToastTheme,
  createToastElement
} = require('../assets/js/modules/toast.js');

describe('Standalone Toast Module Tests', () => {
  describe('escapeToastText', () => {
    test('sanitizes script tags and HTML quotes', () => {
      const malicious = '<script>alert("XSS")</script>';
      const safe = escapeToastText(malicious);
      expect(safe).not.toContain('<script>');
      expect(safe).toContain('&lt;script&gt;');
      expect(safe).toContain('&quot;XSS&quot;');
    });

    test('handles empty or null values safely', () => {
      expect(escapeToastText(null)).toBe('');
      expect(escapeToastText(undefined)).toBe('');
      expect(escapeToastText(1234)).toBe('1234');
    });
  });

  describe('getToastTheme', () => {
    test('returns emerald styling for success', () => {
      const theme = getToastTheme('success');
      expect(theme.type).toBe('success');
      expect(theme.colorClasses).toContain('emerald');
    });

    test('returns amber styling for warning', () => {
      const theme = getToastTheme('warning');
      expect(theme.type).toBe('warning');
      expect(theme.colorClasses).toContain('amber');
    });

    test('returns rose styling for error', () => {
      const theme = getToastTheme('error');
      expect(theme.type).toBe('error');
      expect(theme.colorClasses).toContain('rose');
    });

    test('defaults to info theme', () => {
      const theme = getToastTheme('custom');
      expect(theme.type).toBe('info');
      expect(theme.colorClasses).toContain('slate-900');
    });
  });

  describe('createToastElement', () => {
    test('creates toast element with text and dismiss button', () => {
      const el = createToastElement('Profile synchronized', 'success');
      expect(el).toBeInstanceOf(HTMLElement);
      expect(el.textContent).toContain('Profile synchronized');
      expect(el.querySelector('.toast-close')).toBeTruthy();
    });
  });
});
