/**
 * SkillSync - Web Audio API Tactile Sound Engine
 * File: assets/js/modules/audio_feedback.js
 *
 * Provides subtle, mechanical micro-haptics for user actions:
 * - mechanical_click: Soft tactile switch click (tab change, toggle)
 * - success_chime: Two-tone chime for high ATS scores (>85%) or stage promotions
 * - offer_fanfare: Upbeat arpeggio when candidate moves to Offer
 * - audit_ping: Clean acoustic radar ping when credibility audit finishes
 *
 * Lightweight, 0 external audio files (synthesized via Web Audio API oscillators).
 * Opt-in with preference persisted in localStorage.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncAudio = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'skillsync_audio_feedback_enabled';
  let audioCtx = null;
  let isMuted = false;

  function initAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    } catch (e) {
      // AudioContext unavailable or blocked by autoplay policy
    }
    return audioCtx;
  }

  function isAudioEnabled() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return stored === 'true';
      }
    } catch (e) {}
    return false; // Default to subtle opt-in
  }

  function setAudioEnabled(enabled) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      }
    } catch (e) {}
    if (enabled) {
      initAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }
  }

  function playTone(freq, type = 'sine', duration = 0.05, gainValue = 0.04) {
    if (!isAudioEnabled() || isMuted) return;
    const ctx = initAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (err) {
      // Audio node failure fallback
    }
  }

  /**
   * Sound Presets
   */
  function playClick() {
    playTone(850, 'triangle', 0.02, 0.025);
  }

  function playTabSwitch() {
    playTone(600, 'sine', 0.03, 0.02);
  }

  function playSuccessChime() {
    if (!isAudioEnabled() || isMuted) return;
    playTone(523.25, 'sine', 0.08, 0.03); // C5
    setTimeout(() => {
      playTone(659.25, 'sine', 0.12, 0.03); // E5
    }, 70);
  }

  function playOfferFanfare() {
    if (!isAudioEnabled() || isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playTone(freq, 'sine', 0.14, 0.035);
      }, idx * 65);
    });
  }

  function playAuditRadar() {
    if (!isAudioEnabled() || isMuted) return;
    playTone(987.77, 'sine', 0.04, 0.03); // B5
    setTimeout(() => {
      playTone(1318.51, 'sine', 0.15, 0.035); // E6
    }, 50);
  }

  return {
    STORAGE_KEY,
    isAudioEnabled,
    setAudioEnabled,
    playTone,
    playClick,
    playTabSwitch,
    playSuccessChime,
    playOfferFanfare,
    playAuditRadar,
    setMuted: (muted) => { isMuted = !!muted; },
    isMuted: () => isMuted,
    _resetContext: () => { audioCtx = null; }
  };
});
