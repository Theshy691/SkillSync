/**
 * SkillSync - Standalone Roadmap Module Test Suite
 * File: tests/modules_roadmap.test.js
 */

const {
  generateRoadmapCurriculum,
  calculateRoadmapProgress
} = require('../assets/js/modules/roadmap.js');

describe('Standalone Roadmap Module Tests', () => {
  describe('generateRoadmapCurriculum', () => {
    test('generates full 14-day schedule of 6 milestones from missing skills', () => {
      const skills = ['GraphQL', 'Redis', 'Docker'];
      const milestones = generateRoadmapCurriculum(skills);

      expect(milestones).toHaveLength(6);
      expect(milestones[0].dayRange).toBe('Days 1–2');
      expect(milestones[0].skill).toBe('GraphQL');
      expect(milestones[2].skill).toBe('Redis');
      expect(milestones[4].skill).toBe('Docker');
    });

    test('falls back to default architecture curriculum if no skills provided', () => {
      const fallback = generateRoadmapCurriculum([]);
      expect(fallback).toHaveLength(6);
      expect(fallback[0].skill).toBe('System Architecture');
    });
  });

  describe('calculateRoadmapProgress', () => {
    test('calculates 0% when no milestones completed', () => {
      const milestones = generateRoadmapCurriculum(['React']);
      const progress = calculateRoadmapProgress(milestones, {});
      expect(progress.completed).toBe(0);
      expect(progress.percent).toBe(0);
      expect(progress.label).toBe('0 / 6 Milestones (0%)');
    });

    test('calculates accurate percentage when milestones are toggled', () => {
      const milestones = generateRoadmapCurriculum(['React']);
      const progress = calculateRoadmapProgress(milestones, {
        milestone_1: true,
        milestone_2: true,
        milestone_3: true
      });
      expect(progress.completed).toBe(3);
      expect(progress.percent).toBe(50);
      expect(progress.label).toBe('3 / 6 Milestones (50%)');
    });

    test('handles empty milestones gracefully', () => {
      const progress = calculateRoadmapProgress([], {});
      expect(progress.total).toBe(0);
      expect(progress.percent).toBe(0);
    });
  });
});
