/**
 * @file tests/odometer.test.js
 * Comprehensive unit test suite for the Rolling Number Odometer & Radial Gauge Engine
 */

const SkillSyncOdometer = require('../assets/js/modules/odometer.js');

describe('Rolling Number Odometer & Radial Gauge Engine Test Suite', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('easeOutCubic returns monotonic deceleration curve from 0 to 1', () => {
    expect(SkillSyncOdometer.easeOutCubic(0)).toBe(0);
    expect(SkillSyncOdometer.easeOutCubic(1)).toBe(1);
    expect(SkillSyncOdometer.easeOutCubic(0.5)).toBeGreaterThan(0.5); // Concave down / decelerating
  });

  test('calculateRadialMetrics computes exact circumference and stroke offset for r=40', () => {
    const full = SkillSyncOdometer.calculateRadialMetrics(100, 40);
    expect(full.circumference).toBeCloseTo(251.33, 1);
    expect(full.offset).toBe(0);
    expect(full.color).toBe('#10b981'); // Emerald for 100

    const zero = SkillSyncOdometer.calculateRadialMetrics(0, 40);
    expect(zero.offset).toBeCloseTo(251.33, 1);
    expect(zero.color).toBe('#f43f5e'); // Rose for 0

    const mid = SkillSyncOdometer.calculateRadialMetrics(60, 40);
    expect(mid.offset).toBeCloseTo(251.33 * 0.4, 1);
    expect(mid.color).toBe('#f59e0b'); // Amber for 60
  });

  test('animateScoreCounter animates target element and executes onComplete', () => {
    const mockEl = { textContent: '0%' };
    const onTick = jest.fn();
    const onComplete = jest.fn();

    SkillSyncOdometer.animateScoreCounter({
      target: 85,
      start: 0,
      duration: 500,
      element: mockEl,
      suffix: '%',
      onTick,
      onComplete
    });

    jest.advanceTimersByTime(250);
    expect(onTick).toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onComplete).toHaveBeenCalledWith(85);
    expect(mockEl.textContent).toBe('85%');
  });

  test('animateScoreCounter cancel method stops animation immediately', () => {
    const onTick = jest.fn();
    const onComplete = jest.fn();

    const cancel = SkillSyncOdometer.animateScoreCounter({
      target: 90,
      duration: 1000,
      onTick,
      onComplete
    });

    cancel();
    jest.advanceTimersByTime(1200);

    expect(onComplete).not.toHaveBeenCalled();
  });

  test('calculateRadialMetrics clamps out-of-bounds scores safely', () => {
    const over = SkillSyncOdometer.calculateRadialMetrics(150);
    expect(over.score).toBe(100);

    const under = SkillSyncOdometer.calculateRadialMetrics(-20);
    expect(under.score).toBe(0);
  });
});
