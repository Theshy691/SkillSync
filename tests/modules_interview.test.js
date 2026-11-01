/**
 * SkillSync - Standalone Interview Simulator Module Test Suite
 * File: tests/modules_interview.test.js
 */

const {
  IMPACT_KEYWORDS,
  evaluateInterviewAnswer
} = require('../assets/js/modules/interview.js');

describe('Standalone Interview Simulator Module Tests', () => {
  const sampleQuestion = {
    id: 101,
    question: 'How do you design high-availability Kafka consumers?',
    talking_points: [
      'Consumer group partition rebalancing',
      'Idempotent processing and deduplication',
      'Dead-letter queues for unhandled failures'
    ]
  };

  describe('IMPACT_KEYWORDS', () => {
    test('contains engineering impact metrics terms', () => {
      expect(IMPACT_KEYWORDS).toContain('latency');
      expect(IMPACT_KEYWORDS).toContain('throughput');
      expect(IMPACT_KEYWORDS).toContain('optimiz');
      expect(IMPACT_KEYWORDS).toContain('failover');
    });
  });

  describe('evaluateInterviewAnswer', () => {
    test('rewards detailed answer covering multiple talking points and impact metrics', () => {
      const strongAnswer = `To guarantee high availability, we configured consumer group partition rebalancing with static membership. We enforced idempotent processing using Redis locks to eliminate duplicate messages, and routed unhandled poison pills to dead-letter queues. This reduced pipeline latency by 35% and scaled throughput during peak events.`;

      const result = evaluateInterviewAnswer(sampleQuestion, strongAnswer);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('Exceptional Delivery');
      expect(result.coveredPoints.length).toBeGreaterThanOrEqual(2);
      expect(result.missingPoints.length).toBeLessThanOrEqual(1);
    });

    test('penalizes ultra-short answers with Needs Practice', () => {
      const shortAnswer = 'I use consumer groups.';
      const result = evaluateInterviewAnswer(sampleQuestion, shortAnswer);
      expect(result.score).toBeLessThanOrEqual(50);
      expect(result.grade).toBe('Needs Practice');
    });

    test('handles empty or missing question points gracefully', () => {
      const result = evaluateInterviewAnswer({}, 'We built a system that improved reliability.');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('grade');
    });
  });
});

