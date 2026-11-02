/**
 * @file tests/typewriter.test.js
 * Comprehensive unit test suite for the Streaming Copilot Typewriter Engine
 */

const SkillSyncTypewriter = require('../assets/js/modules/typewriter.js');

describe('Streaming Copilot Typewriter Engine Test Suite', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('streamText streams characters sequentially into DOM element', () => {
    const mockEl = { textContent: '' };
    const onComplete = jest.fn();

    SkillSyncTypewriter.streamText({
      text: 'SkillSync',
      element: mockEl,
      speedMs: 10,
      onComplete
    });

    jest.advanceTimersByTime(50);
    expect(mockEl.textContent.length).toBeGreaterThan(0);
    expect(mockEl.textContent.length).toBeLessThan(9);

    jest.advanceTimersByTime(100);
    expect(mockEl.textContent).toBe('SkillSync');
    expect(onComplete).toHaveBeenCalledWith('SkillSync');
  });

  test('streamText word mode streams word tokens into textarea value', () => {
    const mockTextarea = { value: '' };
    const onComplete = jest.fn();

    SkillSyncTypewriter.streamText({
      text: 'Senior Cloud Platform Architect',
      element: mockTextarea,
      mode: 'word',
      speedMs: 15,
      onComplete
    });

    jest.runAllTimers();
    expect(mockTextarea.value).toBe('Senior Cloud Platform Architect');
    expect(onComplete).toHaveBeenCalled();
  });

  test('flush method immediately outputs complete text and triggers onComplete', () => {
    const mockEl = { textContent: '' };
    const onComplete = jest.fn();

    const controller = SkillSyncTypewriter.streamText({
      text: 'Instant Application Bundle Ready',
      element: mockEl,
      speedMs: 100,
      onComplete
    });

    controller.flush();
    expect(mockEl.textContent).toBe('Instant Application Bundle Ready');
    expect(onComplete).toHaveBeenCalled();
  });

  test('cancel method stops streaming without completing full string', () => {
    const mockEl = { textContent: '' };
    const onComplete = jest.fn();

    const controller = SkillSyncTypewriter.streamText({
      text: 'Super Long Streaming Narrative',
      element: mockEl,
      speedMs: 50,
      onComplete
    });

    jest.advanceTimersByTime(60);
    controller.cancel();
    jest.advanceTimersByTime(500);

    expect(mockEl.textContent.length).toBeLessThan(20);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
