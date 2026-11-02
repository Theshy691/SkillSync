/**
 * @jest-environment jsdom
 */

const SkillSyncAudio = require('../assets/js/modules/audio_feedback.js');

describe('Web Audio API Tactile Sound Engine Test Suite', () => {
  let mockOscillator;
  let mockGain;
  let mockAudioContext;

  beforeEach(() => {
    localStorage.clear();
    SkillSyncAudio.setMuted(false);
    SkillSyncAudio._resetContext();

    mockOscillator = {
      type: 'sine',
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    };

    mockGain = {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      },
      connect: jest.fn()
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn().mockReturnValue(mockOscillator),
      createGain: jest.fn().mockReturnValue(mockGain),
      resume: jest.fn().mockResolvedValue()
    };

    window.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
  });

  afterEach(() => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  test('defaults to audio disabled for opt-in subtlety', () => {
    expect(SkillSyncAudio.isAudioEnabled()).toBe(false);
  });

  test('setAudioEnabled toggles and persists preference in localStorage', () => {
    SkillSyncAudio.setAudioEnabled(true);
    expect(SkillSyncAudio.isAudioEnabled()).toBe(true);
    expect(localStorage.getItem(SkillSyncAudio.STORAGE_KEY)).toBe('true');

    SkillSyncAudio.setAudioEnabled(false);
    expect(SkillSyncAudio.isAudioEnabled()).toBe(false);
    expect(localStorage.getItem(SkillSyncAudio.STORAGE_KEY)).toBe('false');
  });

  test('playTone does not execute when audio is disabled', () => {
    SkillSyncAudio.setAudioEnabled(false);
    SkillSyncAudio.playTone(440);
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  test('playTone creates oscillator and ramps gain when enabled', () => {
    SkillSyncAudio.setAudioEnabled(true);
    SkillSyncAudio.playTone(440, 'triangle', 0.05, 0.03);

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  test('setMuted suppresses sound playback even when audio is enabled', () => {
    SkillSyncAudio.setAudioEnabled(true);
    SkillSyncAudio.setMuted(true);
    expect(SkillSyncAudio.isMuted()).toBe(true);

    SkillSyncAudio.playTone(500);
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  test('presets execute without throwing errors', () => {
    SkillSyncAudio.setAudioEnabled(true);
    expect(() => {
      SkillSyncAudio.playClick();
      SkillSyncAudio.playTabSwitch();
      SkillSyncAudio.playSuccessChime();
      SkillSyncAudio.playOfferFanfare();
      SkillSyncAudio.playAuditRadar();
    }).not.toThrow();
  });
});
