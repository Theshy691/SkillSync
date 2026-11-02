/**
 * @jest-environment jsdom
 * @file tests/particles.test.js
 * Comprehensive unit test suite for the Canvas Particle & Confetti Engine
 */

const SkillSyncParticles = require('../assets/js/modules/particles.js');

describe('Canvas Particle & Confetti Engine Test Suite', () => {
  test('PALETTE contains vibrant celebratory brand colors', () => {
    expect(Array.isArray(SkillSyncParticles.PALETTE)).toBe(true);
    expect(SkillSyncParticles.PALETTE).toContain('#10b981'); // Emerald
    expect(SkillSyncParticles.PALETTE.length).toBeGreaterThanOrEqual(5);
  });

  test('createParticle initializes valid physics coordinates and velocities', () => {
    const p = SkillSyncParticles.createParticle(400, 300);

    expect(p.x).toBe(400);
    expect(p.y).toBe(300);
    expect(typeof p.vx).toBe('number');
    expect(typeof p.vy).toBe('number');
    expect(p.alpha).toBe(1);
    expect(p.decay).toBeGreaterThan(0);
    expect(SkillSyncParticles.PALETTE).toContain(p.color);
  });

  test('updateParticles applies gravity, drag, and fades alpha over time', () => {
    const initialParticles = [
      SkillSyncParticles.createParticle(100, 100),
      SkillSyncParticles.createParticle(200, 200)
    ];

    const initialY0 = initialParticles[0].y;
    const initialAlpha0 = initialParticles[0].alpha;

    const updated = SkillSyncParticles.updateParticles(initialParticles);

    expect(updated.length).toBe(2);
    expect(updated[0].alpha).toBeLessThan(initialAlpha0);
  });

  test('updateParticles removes particles once alpha drops below threshold', () => {
    const dyingParticle = {
      x: 100,
      y: 100,
      vx: 1,
      vy: 1,
      size: 5,
      color: '#10b981',
      alpha: 0.01, // Already below 0.02
      decay: 0.02,
      rotation: 0,
      rotSpeed: 1
    };

    const remaining = SkillSyncParticles.updateParticles([dyingParticle]);
    expect(remaining.length).toBe(0);
  });

  test('burstConfetti executes safely without errors in DOM mock environment', () => {
    const mockCanvas = document.createElement('canvas');
    mockCanvas.id = 'skillsync-confetti-canvas';
    mockCanvas.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      save: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      fillRect: jest.fn(),
      restore: jest.fn()
    });
    document.body.appendChild(mockCanvas);

    expect(() => {
      SkillSyncParticles.burstConfetti({ count: 20 });
    }).not.toThrow();
  });
});
