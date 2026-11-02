/**
 * SkillSync - Input Validation Module
 * File: assets/js/modules/validation.js
 *
 * Standalone validation helpers for person names, resume version labels,
 * and geographic/remote location strings.
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validatePersonName,
    validateVersionName,
    validateLocationName,
    validatePasswordConfirmation
  };
}

if (typeof window !== 'undefined') {
  window.SkillSyncValidation = {
    validatePersonName,
    validateVersionName,
    validateLocationName,
    validatePasswordConfirmation
  };
}
