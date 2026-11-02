/**
 * SkillSync - Standalone Interview Simulator Module Test Suite
 * File: tests/modules_interview.test.js
 *
 * Verifies trilingual evaluation (English, Tagalog, Taglish), STAR model answer
 * generation, and custom interview question synthesis.
 */

const {
  IMPACT_KEYWORDS,
  TAGALOG_IMPACT_KEYWORDS,
  detectAnswerLanguage,
  generateModelAnswer,
  evaluateInterviewAnswer,
  createCustomInterviewQuestion
} = require('../assets/js/modules/interview.js');

describe('Standalone Interview Simulator Module Tests', () => {
  const sampleQuestion = {
    id: 101,
    target_skill: 'Kafka',
    question: 'How do you design high-availability Kafka consumers?',
    interviewer_intent: 'Tests production cache strategy and concurrency control.',
    talking_points: [
      'Consumer group partition rebalancing',
      'Idempotent processing and deduplication',
      'Dead-letter queues for unhandled failures'
    ]
  };

  describe('IMPACT_KEYWORDS & Vocabulary Taxonomies', () => {
    test('contains engineering impact metrics terms', () => {
      expect(IMPACT_KEYWORDS).toContain('latency');
      expect(IMPACT_KEYWORDS).toContain('throughput');
      expect(IMPACT_KEYWORDS).toContain('optimiz');
      expect(IMPACT_KEYWORDS).toContain('failover');
    });

    test('contains Tagalog and Taglish code-switching tech verbs and stems', () => {
      expect(TAGALOG_IMPACT_KEYWORDS).toContain('nag-implement');
      expect(TAGALOG_IMPACT_KEYWORDS).toContain('nag-deploy');
      expect(TAGALOG_IMPACT_KEYWORDS).toContain('nag-scale');
      expect(TAGALOG_IMPACT_KEYWORDS).toContain('bumaba');
      expect(TAGALOG_IMPACT_KEYWORDS).toContain('tumaas');
      expect(TAGALOG_IMPACT_KEYWORDS).toContain('solusyon');
    });
  });

  describe('Language Modality Detection (detectAnswerLanguage)', () => {
    test('identifies pure English responses', () => {
      const text = 'In our architecture, we decoupled microservices with Kafka message brokers to optimize throughput.';
      expect(detectAnswerLanguage(text)).toBe('English');
    });

    test('identifies Taglish tech code-switching responses with Filipino affixes and particles', () => {
      const taglishText = 'Nag-deploy kami ng Kafka consumer groups with idempotent processing tapos bumaba yung latency ng 40%.';
      expect(detectAnswerLanguage(taglishText)).toBe('Taglish');
    });

    test('identifies formal Tagalog responses', () => {
      const tagalogText = 'Sa aming nakaraang proyekto, pinangunahan ko ang paglalatag ng sistema upang maiwasan ang pagbagal ng transaksyon sa mga gumagamit.';
      expect(detectAnswerLanguage(tagalogText)).toBe('Tagalog');
    });

    test('defaults safely to English on empty or non-string input', () => {
      expect(detectAnswerLanguage('')).toBe('English');
      expect(detectAnswerLanguage(null)).toBe('English');
    });
  });

  describe('Exemplary STAR Model Answer Synthesizer (generateModelAnswer)', () => {
    test('synthesizes English STAR model answer with metrics and why_better reasons', () => {
      const modelAnswer = generateModelAnswer(sampleQuestion, 'English');
      expect(modelAnswer.language).toBe('English');
      expect(modelAnswer.star_answer).toContain('latency');
      expect(modelAnswer.why_better.length).toBeGreaterThanOrEqual(3);
      expect(modelAnswer.situation_task).toBeTruthy();
      expect(modelAnswer.action).toBeTruthy();
      expect(modelAnswer.result).toBeTruthy();
    });

    test('synthesizes Taglish STAR model answer for Philippine tech interviews', () => {
      const modelAnswer = generateModelAnswer(sampleQuestion, 'Taglish');
      expect(modelAnswer.language).toBe('Taglish');
      expect(modelAnswer.star_answer).toContain('Sa previous production project namin');
      expect(modelAnswer.star_answer).toContain('bumaba ang p99 API latency');
      expect(modelAnswer.why_better[0]).toContain('STAR method');
    });

    test('synthesizes formal Tagalog model answer', () => {
      const modelAnswer = generateModelAnswer(sampleQuestion, 'Tagalog');
      expect(modelAnswer.language).toBe('Tagalog');
      expect(modelAnswer.star_answer).toContain('Sa aming nakaraang proyekto');
    });
  });

  describe('Trilingual Answer Evaluation (evaluateInterviewAnswer)', () => {
    test('rewards detailed English answer covering talking points and impact metrics', () => {
      const strongAnswer = `To guarantee high availability, we configured consumer group partition rebalancing with static membership. We enforced idempotent processing using Redis locks to eliminate duplicate messages, and routed unhandled poison pills to dead-letter queues. This reduced pipeline latency by 35% and scaled throughput during peak events.`;

      const result = evaluateInterviewAnswer(sampleQuestion, strongAnswer);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('Exceptional Delivery');
      expect(result.language_detected).toBe('English');
      expect(result.coveredPoints.length).toBeGreaterThanOrEqual(2);
      expect(result.missingPoints.length).toBeLessThanOrEqual(1);
      expect(result.better_answer).toHaveProperty('star_answer');
    });

    test('fairly evaluates and rewards natural Taglish technical answers without linguistic bias', () => {
      const taglishAnswer = `Noong nag-spike ang traffic, nag-setup kami ng consumer group partition rebalancing para walang downtime. Nag-implement din ako ng idempotent processing at nilagyan ng dead-letter queues para sa unhandled errors. Dahil dito, bumaba ang latency ng 40% at na-optimize ang throughput namin.`;

      const result = evaluateInterviewAnswer(sampleQuestion, taglishAnswer);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('Napakahusay na Sagot');
      expect(result.language_detected).toBe('Taglish');
      expect(result.critique).toContain('Napakahusay!');
      expect(result.better_answer.language).toBe('Taglish');
    });

    test('penalizes ultra-short answers with Needs Practice / Kailangan ng Ensayo', () => {
      const shortAnswer = 'I use consumer groups.';
      const result = evaluateInterviewAnswer(sampleQuestion, shortAnswer);
      expect(result.score).toBeLessThanOrEqual(50);
      expect(result.grade).toBe('Needs Practice');
    });

    test('handles empty or missing question points gracefully', () => {
      const result = evaluateInterviewAnswer({}, 'We built a system that improved reliability.');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('better_answer');
    });
  });

  describe('Custom Question Synthesis (createCustomInterviewQuestion)', () => {
    test('builds complete custom question with custom flag and default talking points', () => {
      const customQ = createCustomInterviewQuestion(
        'How do you manage schema migrations with zero database downtime?',
        'PostgreSQL',
        'Data Layer & Optimization'
      );

      expect(customQ.is_custom).toBe(true);
      expect(customQ.question).toContain('schema migrations');
      expect(customQ.target_skill).toBe('PostgreSQL');
      expect(customQ.category).toBe('Data Layer & Optimization');
      expect(customQ.talking_points.length).toBe(3);
      expect(customQ.interviewer_intent).toContain('PostgreSQL');
    });
  });
});
