/**
 * SkillSync - Lightweight High-Performance Canvas Particle & Confetti Engine
 * File: assets/js/modules/particles.js
 *
 * Simulates micro-particle bursts with gravity, drag, and rotation physics
 * for rewarding high ATS scores (>=85%) and job offer milestones. Zero external dependencies.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncParticles = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const PALETTE = [
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#ec4899'  // Pink
  ];

  /**
   * Generates a single particle with physics attributes
   * @param {number} originX
   * @param {number} originY
   * @returns {Object} Particle model
   */
  function createParticle(originX, originY) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;

    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.5, // Slight upward bias
      size: 5 + Math.random() * 5,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: 1,
      decay: 0.012 + Math.random() * 0.016,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      wobble: Math.random() * 10
    };
  }

  /**
   * Simulates one tick of physics on particle collection
   * @param {Array} particles
   * @param {number} [gravity=0.22]
   * @param {number} [drag=0.985]
   * @returns {Array} Remaining active particles
   */
  function updateParticles(particles, gravity = 0.22, drag = 0.985) {
    if (!Array.isArray(particles)) return [];

    return particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= drag;
      p.vy *= drag;
      p.vy += gravity;
      p.alpha -= p.decay;
      p.rotation += p.rotSpeed;
      return p.alpha > 0.02 && p.y < 2000;
    });
  }

  /**
   * Canvas Burst Controller for In-Browser Rendering
   */
  let activeAnimationId = null;
  let activeParticles = [];

  function getOrCreateCanvas() {
    if (typeof document === 'undefined') return null;

    let canvas = document.getElementById('skillsync-confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'skillsync-confetti-canvas';
      document.body.appendChild(canvas);
    }

    canvas.width = window.innerWidth || 800;
    canvas.height = window.innerHeight || 600;
    return canvas;
  }

  function renderFrame(canvas, ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    activeParticles = updateParticles(activeParticles);

    activeParticles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
      ctx.restore();
    });

    if (activeParticles.length > 0) {
      activeAnimationId = requestAnimationFrame(() => renderFrame(canvas, ctx));
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      activeAnimationId = null;
    }
  }

  /**
   * Triggers celebratory confetti burst from specified origin (default center screen)
   * @param {Object} [options]
   * @param {number} [options.count=65] - Number of particles
   * @param {number} [options.x] - X coordinate
   * @param {number} [options.y] - Y coordinate
   */
  function burstConfetti(options = {}) {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const canvas = getOrCreateCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const count = options.count || 65;
    const originX = typeof options.x === 'number' ? options.x : window.innerWidth / 2;
    const originY = typeof options.y === 'number' ? options.y : window.innerHeight * 0.35;

    for (let i = 0; i < count; i++) {
      activeParticles.push(createParticle(originX, originY));
    }

    if (!activeAnimationId) {
      activeAnimationId = requestAnimationFrame(() => renderFrame(canvas, ctx));
    }
  }

  return {
    PALETTE,
    createParticle,
    updateParticles,
    burstConfetti
  };
}));
