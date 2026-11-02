/**
 * SkillSync - High-Precision Rolling Number Odometer & Radial Gauge Engine
 * File: assets/js/modules/odometer.js
 *
 * Implements smooth ease-out numeric transitions using requestAnimationFrame
 * and calculates SVG circular progress track metrics for ATS score visualization.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncOdometer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Cubic ease-out curve for natural, deceleration-focused transitions
   * @param {number} t - normalized progress [0, 1]
   * @returns {number} eased progress [0, 1]
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Animates a numeric element or custom onTick callback
   * @param {Object} options
   * @param {number} options.target - Final target value (e.g. 88)
   * @param {number} [options.start=0] - Initial value
   * @param {number} [options.duration=850] - Duration in ms
   * @param {HTMLElement} [options.element] - Target element to update textContent
   * @param {string} [options.suffix=''] - Suffix like '%'
   * @param {Function} [options.onTick] - Callback receiving (currentValue, progress)
   * @param {Function} [options.onComplete] - Callback when animation finishes
   * @returns {Function} Cancel function to stop animation early
   */
  function animateScoreCounter(options) {
    if (!options || typeof options.target !== 'number') {
      throw new Error('options.target must be a valid number');
    }

    const startVal = typeof options.start === 'number' ? options.start : 0;
    const targetVal = options.target;
    const duration = options.duration || 850;
    const suffix = options.suffix || '';
    const element = options.element || null;
    const onTick = typeof options.onTick === 'function' ? options.onTick : null;
    const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;

    let startTime = null;
    let animId = null;
    let cancelled = false;

    // In non-browser / test environments without requestAnimationFrame
    const reqAnim = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(Date.now()), 16);

    const cancelAnim = typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : clearTimeout;

    function step(timestamp) {
      if (cancelled) return;
      if (!startTime) startTime = timestamp;

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      const current = Math.round(startVal + (targetVal - startVal) * eased);

      if (element) {
        element.textContent = `${current}${suffix}`;
      }

      if (onTick) {
        onTick(current, progress);
      }

      if (progress < 1) {
        animId = reqAnim(step);
      } else {
        if (element) {
          element.textContent = `${targetVal}${suffix}`;
        }
        if (onComplete) {
          onComplete(targetVal);
        }
      }
    }

    animId = reqAnim(step);

    return function cancel() {
      cancelled = true;
      if (animId) cancelAnim(animId);
    };
  }

  /**
   * Calculates SVG circular track dashoffset
   * Circumference for r=40 is 2 * Math.PI * 40 = 251.327
   * @param {number} score - Score value (0 to 100)
   * @param {number} [radius=40] - Circle radius in px
   * @returns {Object} { circumference, offset, color }
   */
  function calculateRadialMetrics(score, radius = 40) {
    const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)));
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safeScore / 100) * circumference;

    let color = '#f43f5e'; // Rose (< 50)
    let glow = 'rgba(244, 63, 94, 0.35)';
    if (safeScore >= 75) {
      color = '#10b981'; // Emerald
      glow = 'rgba(16, 185, 129, 0.45)';
    } else if (safeScore >= 50) {
      color = '#f59e0b'; // Amber
      glow = 'rgba(245, 158, 11, 0.4)';
    }

    return {
      score: safeScore,
      circumference: Number(circumference.toFixed(2)),
      offset: Number(offset.toFixed(2)),
      color,
      glow
    };
  }

  return {
    easeOutCubic,
    animateScoreCounter,
    calculateRadialMetrics
  };
}));
