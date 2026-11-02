/**
 * SkillSync - Streaming Copilot Typewriter Effect Engine
 * File: assets/js/modules/typewriter.js
 *
 * Implements smooth token-by-token or character-by-character typewriter streaming
 * with cancelation tokens and instant-flush capabilities for AI generated application assets.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncTypewriter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Streams text smoothly into an element or textarea
   * @param {Object} options
   * @param {string} options.text - Full text to stream
   * @param {HTMLElement} [options.element] - Target element to append text
   * @param {string} [options.mode='char'] - 'char' | 'word'
   * @param {number} [options.speedMs=12] - Milliseconds per unit
   * @param {Function} [options.onChunk] - (currentText, chunk) => void
   * @param {Function} [options.onComplete] - (fullText) => void
   * @returns {Object} { cancel: Function, flush: Function }
   */
  function streamText(options) {
    if (!options || typeof options.text !== 'string') {
      throw new Error('options.text must be a valid string');
    }

    const fullText = options.text;
    const element = options.element || null;
    const mode = options.mode || 'char';
    const speedMs = typeof options.speedMs === 'number' ? options.speedMs : 12;
    const onChunk = typeof options.onChunk === 'function' ? options.onChunk : null;
    const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;

    const units = mode === 'word'
      ? fullText.split(/(\s+)/)
      : Array.from(fullText);

    let currentIndex = 0;
    let accumulated = '';
    let timerId = null;
    let isTerminated = false;

    if (element) {
      if ('value' in element) {
        element.value = '';
      } else {
        element.textContent = '';
      }
    }

    function tick() {
      if (isTerminated) return;

      if (currentIndex < units.length) {
        const chunk = units[currentIndex];
        accumulated += chunk;
        currentIndex++;

        if (element) {
          if ('value' in element) {
            element.value = accumulated;
          } else {
            element.textContent = accumulated;
          }
        }

        if (onChunk) {
          onChunk(accumulated, chunk);
        }

        // Add slight human micro-pause after sentence punctuation
        let delay = speedMs;
        if (chunk === '.' || chunk === '!' || chunk === '?') {
          delay = speedMs * 4;
        }

        timerId = setTimeout(tick, delay);
      } else {
        isTerminated = true;
        if (onComplete) {
          onComplete(fullText);
        }
      }
    }

    timerId = setTimeout(tick, speedMs);

    function cancel() {
      isTerminated = true;
      if (timerId) clearTimeout(timerId);
    }

    function flush() {
      cancel();
      accumulated = fullText;
      if (element) {
        if ('value' in element) {
          element.value = fullText;
        } else {
          element.textContent = fullText;
        }
      }
      if (onComplete) {
        onComplete(fullText);
      }
    }

    return { cancel, flush };
  }

  return {
    streamText
  };
}));
