/**
 * SkillSync - Interactive 5-Axis SVG Match Radar (Spider Chart) Engine
 * File: assets/js/modules/radar_chart.js
 *
 * Generates mathematical multi-dimensional polygon radar visualizations
 * comparing candidate competencies against target job benchmarks.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncRadarChart = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const RADAR_AXES = [
    { key: 'core_tech', label: 'Core Tech' },
    { key: 'cloud_devops', label: 'Cloud & DevOps' },
    { key: 'system_scale', label: 'Architecture' },
    { key: 'quant_impact', label: 'Impact Metrics' },
    { key: 'domain_fit', label: 'Seniority' }
  ];

  /**
   * Calculates 5-dimensional scores for candidate vs target job
   * @param {Object} options
   * @param {number} [options.overallScore=75]
   * @param {Object} [options.breakdown]
   * @param {string} [options.resume='']
   * @param {string} [options.job='']
   * @returns {Object} { candidate: Object, target: Object }
   */
  function calculateRadarScores(options = {}) {
    const base = typeof options.overallScore === 'number' ? options.overallScore : 72;
    const bd = options.breakdown || {};

    const candidate = {
      core_tech: Math.min(100, Math.max(15, bd.keyword_match || Math.round(base * 1.05))),
      cloud_devops: Math.min(100, Math.max(15, bd.skills_alignment || Math.round(base * 0.95))),
      system_scale: Math.min(100, Math.max(15, bd.relevance || Math.round(base * 0.98))),
      quant_impact: Math.min(100, Math.max(15, bd.completeness || Math.round(base * 0.9))),
      domain_fit: Math.min(100, Math.max(15, Math.round(base * 1.02)))
    };

    const target = {
      core_tech: 90,
      cloud_devops: 85,
      system_scale: 85,
      quant_impact: 80,
      domain_fit: 85
    };

    return { candidate, target, axes: RADAR_AXES };
  }

  /**
   * Converts polar coordinate to Cartesian (X, Y)
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} r - Radius
   * @param {number} angleRad - Angle in radians (0 at top, clockwise)
   * @returns {Array} [x, y]
   */
  function polarToCartesian(cx, cy, r, angleRad) {
    return [
      Number((cx + r * Math.sin(angleRad)).toFixed(2)),
      Number((cy - r * Math.cos(angleRad)).toFixed(2))
    ];
  }

  /**
   * Generates polygon point string for an array of values [0, 100]
   * @param {Array<number>} values
   * @param {number} cx
   * @param {number} cy
   * @param {number} maxRadius
   * @returns {string} e.g. "150,50 240,110 ..."
   */
  function calculatePolygonPoints(values, cx, cy, maxRadius) {
    const totalAxes = RADAR_AXES.length;
    const angleStep = (2 * Math.PI) / totalAxes;

    return values.map((val, i) => {
      const safeVal = Math.max(0, Math.min(100, val || 0));
      const r = (safeVal / 100) * maxRadius;
      const [x, y] = polarToCartesian(cx, cy, r, i * angleStep);
      return `${x},${y}`;
    }).join(' ');
  }

  /**
   * Generates self-contained SVG element markup
   * @param {Object} scores - Output of calculateRadarScores
   * @param {number} [size=320] - SVG viewBox dimension
   * @returns {string} SVG HTML string
   */
  function renderRadarSvg(scores, size = 320) {
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size * 0.38;
    const totalAxes = RADAR_AXES.length;
    const angleStep = (2 * Math.PI) / totalAxes;

    // 1. Concentric Web Rings (25%, 50%, 75%, 100%)
    const ringTiers = [0.25, 0.5, 0.75, 1.0];
    const webRingsHtml = ringTiers.map(ratio => {
      const ringPoints = [];
      for (let i = 0; i < totalAxes; i++) {
        const [x, y] = polarToCartesian(cx, cy, maxRadius * ratio, i * angleStep);
        ringPoints.push(`${x},${y}`);
      }
      return `<polygon points="${ringPoints.join(' ')}" class="radar-web-ring" />`;
    }).join('');

    // 2. Radial Axis Lines & Labels
    const axesHtml = RADAR_AXES.map((axis, i) => {
      const angle = i * angleStep;
      const [endX, endY] = polarToCartesian(cx, cy, maxRadius, angle);
      const [labelX, labelY] = polarToCartesian(cx, cy, maxRadius + 18, angle);

      let textAnchor = 'middle';
      if (Math.sin(angle) > 0.3) textAnchor = 'start';
      if (Math.sin(angle) < -0.3) textAnchor = 'end';

      return `
        <line x1="${cx}" y1="${cy}" x2="${endX}" y2="${endY}" class="radar-axis-line" />
        <text x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" dominant-baseline="central" font-size="11" font-family="'DM Sans', sans-serif" fill="var(--ink-2)" font-weight="600">
          ${axis.label}
        </text>
      `;
    }).join('');

    // 3. Target Baseline Polygon
    const targetValues = RADAR_AXES.map(a => scores.target[a.key] || 85);
    const targetPoints = calculatePolygonPoints(targetValues, cx, cy, maxRadius);

    // 4. Candidate Polygon & Vertices
    const candidateValues = RADAR_AXES.map(a => scores.candidate[a.key] || 70);
    const candidatePoints = calculatePolygonPoints(candidateValues, cx, cy, maxRadius);

    const vertexDotsHtml = candidateValues.map((val, i) => {
      const r = (val / 100) * maxRadius;
      const [x, y] = polarToCartesian(cx, cy, r, i * angleStep);
      return `<circle cx="${x}" cy="${y}" r="4" class="radar-vertex-dot" data-score="${val}" data-axis="${RADAR_AXES[i].label}"><title>${RADAR_AXES[i].label}: ${val}%</title></circle>`;
    }).join('');

    return `
      <svg class="radar-chart-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <g class="radar-grid">${webRingsHtml}${axesHtml}</g>
        <polygon points="${targetPoints}" class="radar-polygon-target" />
        <polygon points="${candidatePoints}" class="radar-polygon-candidate" />
        <g class="radar-vertices">${vertexDotsHtml}</g>
      </svg>
    `;
  }

  return {
    RADAR_AXES,
    calculateRadarScores,
    polarToCartesian,
    calculatePolygonPoints,
    renderRadarSvg
  };
}));
