/**
 * SkillSync - Standalone Validation Module Tests
 * File: tests/modules_validation.test.js
 */

const {
  validatePersonName,
  validateVersionName,
  validateLocationName
} = require('../assets/js/modules/validation.js');

describe('Standalone Validation Module Tests', () => {
  test('validatePersonName verifies clean names and blocks numbers', () => {
    expect(validatePersonName('James Sarmiento').valid).toBe(true);
    expect(validatePersonName('James123').valid).toBe(false);
    expect(validatePersonName('James123').error).toBe('Name cannot contain numbers.');
  });

  test('validateVersionName blocks purely numeric identifiers', () => {
    expect(validateVersionName('FullStack v1').valid).toBe(true);
    expect(validateVersionName('12345').valid).toBe(false);
  });

  test('validateLocationName blocks numeric locations', () => {
    expect(validateLocationName('Remote').valid).toBe(true);
    expect(validateLocationName('San Francisco 123').valid).toBe(false);
  });
});
