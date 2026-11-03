/**
 * SkillSync - Standalone Interview Simulator Module Test Suite
 * File: tests/modules_interview.test.js
 *
 * Verifies trilingual evaluation (English, Tagalog, Taglish), STAR model answer
 * generation, and custom interview question synthesis.
 */

const SkillSyncInterview = require('../assets/js/modules/interview.js');
const {
  IMPACT_KEYWORDS,
  TAGALOG_IMPACT_KEYWORDS,
  detectAnswerLanguage,
  generateModelAnswer,
  evaluateInterviewAnswer,
  createCustomInterviewQuestion,
  SYNTHETIC_INTERVIEW_CORPUS,
  findSyntheticQuestion,
  evaluateWithLoopAround
} = SkillSyncInterview;

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
      expect(customQ.talking_points.length).toBeGreaterThanOrEqual(3);
      expect(customQ.interviewer_intent).toContain('PostgreSQL');
    });
  });

  describe('Synthetic Data Corpus & Conversational Loop-Around Engine', () => {
    const { SYNTHETIC_INTERVIEW_CORPUS, findSyntheticQuestion, evaluateWithLoopAround } = SkillSyncInterview;

    test('SYNTHETIC_INTERVIEW_CORPUS contains trilingual Q&A exemplars with loop-around drills', () => {
      expect(Array.isArray(SYNTHETIC_INTERVIEW_CORPUS)).toBe(true);
      expect(SYNTHETIC_INTERVIEW_CORPUS.length).toBeGreaterThanOrEqual(3);

      const first = SYNTHETIC_INTERVIEW_CORPUS[0];
      expect(first).toHaveProperty('question_taglish');
      expect(first).toHaveProperty('question_tagalog');
      expect(first.synthetic_exemplars).toHaveProperty('taglish');
      expect(first.loop_around_prompts).toHaveProperty('taglish');
    });

    test('findSyntheticQuestion returns localized question in Taglish and Tagalog', () => {
      const taglishQ = findSyntheticQuestion('concurrency', 'Taglish');
      expect(taglishQ).toBeDefined();
      expect(taglishQ.question).toContain('nag-spike');

      const tagalogQ = findSyntheticQuestion('Deadlock', 'Tagalog');
      expect(tagalogQ).toBeDefined();
      expect(tagalogQ.question).toContain('deadlock');
    });

    test('evaluateWithLoopAround generates active loop follow-up when score < 85', () => {
      const q = SYNTHETIC_INTERVIEW_CORPUS[0];
      const partialAnswer = 'Nag-setup ako ng Redis para bumilis ang response ng API.';
      const result = evaluateWithLoopAround(q, partialAnswer, { round: 1 });

      expect(result.loop_around).toBeDefined();
      expect(result.loop_around.is_loop_active).toBe(true);
      expect(result.loop_around.followup_question.length).toBeGreaterThan(20);
      expect(result.loop_around.followup_question).toMatch(/Loop-Around Challenge|Pag-ikot ng Pagsasanay/);
    });

    test('evaluateWithLoopAround recognizes round 2 improved answer and completes loop', () => {
      const q = SYNTHETIC_INTERVIEW_CORPUS[0];
      const strongFollowup = 'Para masolusyunan ang cache stampede at traffic spikes, nag-implement ako ng Redis distributed mutex locks gamit ang Redlock algorithm at asynchronous Kafka workers with unique transaction idempotency keys. Bunga nito, bumaba ang latency ng 45% (from 850ms down to 110ms) at walang database lock contention kahit 20,000 req/sec.';
      
      const result = evaluateWithLoopAround(q, strongFollowup, { round: 2 });
      expect(result.loop_around.loop_completed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.loop_around.coaching_tip).toContain('Napakagaling');
    });
  });
});
