/**
 * @file tests/radar_chart.test.js
 * Comprehensive unit test suite for the Interactive 5-Axis SVG Match Radar Engine
 */

const SkillSyncRadarChart = require('../assets/js/modules/radar_chart.js');

describe('Interactive 5-Axis SVG Match Radar Engine Test Suite', () => {
  test('RADAR_AXES defines 5 key technical and domain competency axes', () => {
    expect(SkillSyncRadarChart.RADAR_AXES.length).toBe(5);
    const keys = SkillSyncRadarChart.RADAR_AXES.map(a => a.key);
    expect(keys).toContain('core_tech');
    expect(keys).toContain('cloud_devops');
    expect(keys).toContain('system_scale');
    expect(keys).toContain('quant_impact');
    expect(keys).toContain('domain_fit');
  });

  test('polarToCartesian computes accurate Cartesian coordinates', () => {
    // 0 rad (straight up from center)
    const [x0, y0] = SkillSyncRadarChart.polarToCartesian(100, 100, 50, 0);
    expect(x0).toBeCloseTo(100, 1);
    expect(y0).toBeCloseTo(50, 1);

    // PI / 2 rad (straight right from center)
    const [x90, y90] = SkillSyncRadarChart.polarToCartesian(100, 100, 50, Math.PI / 2);
    expect(x90).toBeCloseTo(150, 1);
    expect(y90).toBeCloseTo(100, 1);
  });

  test('calculateRadarScores derives balanced candidate and target scores', () => {
    const scores = SkillSyncRadarChart.calculateRadarScores({
      overallScore: 85,
      breakdown: {
        keyword_match: 90,
        skills_alignment: 80,
        relevance: 85,
        completeness: 88
      }
    });

    expect(scores.candidate.core_tech).toBe(90);
    expect(scores.candidate.cloud_devops).toBe(80);
    expect(scores.target.core_tech).toBe(90);
  });

  test('renderRadarSvg generates valid SVG containing grid, polygons, and vertex tooltips', () => {
    const scores = SkillSyncRadarChart.calculateRadarScores({ overallScore: 82 });
    const svg = SkillSyncRadarChart.renderRadarSvg(scores, 300);

    expect(svg).toContain('<svg class="radar-chart-svg"');
    expect(svg).toContain('class="radar-polygon-candidate"');
    expect(svg).toContain('class="radar-polygon-target"');
    expect(svg).toContain('Core Tech');
    expect(svg).toContain('class="radar-vertex-dot"');
  });
});
