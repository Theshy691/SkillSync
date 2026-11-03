/**
 * @jest-environment jsdom
 */

const SkillSyncInterview = require('../assets/js/modules/interview.js');
global.SkillSyncInterview = SkillSyncInterview;

const {
  evaluateInterviewAnswer,
  createCustomInterviewQuestion,
  renderInterviewQuestions
} = require('../script.js');

describe('Interactive Mock Interview Answer Simulator Test Suite', () => {
  const mockQuestion = {
    id: 1,
    category: 'Distributed Systems',
    target_skill: 'Redis',
    question: 'How do you handle cache invalidation and stampedes under heavy traffic?',
    interviewer_intent: 'Tests production cache strategy and concurrency control.',
    talking_points: [
      'Probabilistic early expiration algorithm',
      'Distributed mutex locking with Redis',
      'Stale-while-revalidate background refresh'
    ],
    better_answer: {
      star_answer: 'In our production services, we combined Redis distributed mutex locking with probabilistic early expiration to prevent stampedes, cutting p99 latency by 45%.',
      why_better: ['Concrete STAR structure', 'Quantifiable 45% latency drop']
    }
  };

  describe('Answer Evaluation Algorithm', () => {
    test('rates strong answer covering talking points with metrics as Exceptional Delivery', () => {
      const userAnswer = `In our production system, we prevent cache stampedes by combining distributed mutex locking in Redis with probabilistic early expiration. When keys approach TTL, we trigger a stale-while-revalidate background worker, reducing API latency by 45% and optimizing database throughput.`;

      const result = evaluateInterviewAnswer(mockQuestion, userAnswer);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('Exceptional Delivery');
      expect(result.coveredPoints.length).toBeGreaterThanOrEqual(2);
      expect(result.critique).toContain('Excellent response');
      expect(result.better_answer).toHaveProperty('star_answer');
    });

    test('evaluates Taglish code-switching answers fairly with Napakahusay na Sagot', () => {
      const taglishAnswer = `Sa production namin, nag-implement kami ng distributed mutex locking gamit ang Redis at nag-setup ng early expiration. Dahil dito, bumaba ang latency ng 40% at na-optimize ang throughput kahit nag-spike ang traffic.`;

      const result = evaluateInterviewAnswer(mockQuestion, taglishAnswer);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('Napakahusay na Sagot');
      expect(result.language_detected).toBe('Taglish');
      expect(result.better_answer.language).toBe('Taglish');
    });

    test('flags insufficient or brief answers as Needs Practice', () => {
      const userAnswer = 'I use Redis.';
      const result = evaluateInterviewAnswer(mockQuestion, userAnswer);

      expect(result.score).toBeLessThan(50);
      expect(result.grade).toBe('Needs Practice');
      expect(result.critique).toContain('Response is too brief');
    });

    test('identifies covered vs missing talking points accurately', () => {
      const userAnswer = 'We implemented a distributed mutex lock in Redis to synchronize cache refills during traffic spikes.';
      const result = evaluateInterviewAnswer(mockQuestion, userAnswer);

      expect(result.coveredPoints.some(pt => pt.includes('mutex'))).toBe(true);
      expect(result.missingPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Interactive Practice Drawer UI & Better Answer Card', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="interviewQuestionsList"></div>
        <div id="toast-container"></div>
      `;
    });

    test('renderInterviewQuestions renders practice drawer and evaluates answer interactively with Better Answer card', () => {
      renderInterviewQuestions([mockQuestion]);

      const list = document.getElementById('interviewQuestionsList');
      expect(list.children.length).toBe(1);

      const toggleBtn = list.querySelector('.btn-practice-toggle');
      const drawer = list.querySelector('.practice-drawer');
      const input = list.querySelector('.practice-input');
      const evalBtn = list.querySelector('.btn-eval-answer');
      const feedback = list.querySelector('.practice-feedback');

      expect(toggleBtn).toBeTruthy();
      expect(drawer.classList.contains('hidden')).toBe(true);

      // Toggle drawer open
      toggleBtn.click();
      expect(drawer.classList.contains('hidden')).toBe(false);

      // Type answer and evaluate
      input.value = 'We utilize distributed mutex locks and early expiration to optimize latency and reduce load.';
      evalBtn.click();

      expect(feedback.classList.contains('hidden')).toBe(false);
      expect(feedback.innerHTML).toContain('% Match');
      expect(feedback.innerHTML).toContain('Points Covered');
      expect(feedback.innerHTML).toContain('AI Coach\'s Better Answer');
    });

    test('renders Custom Question chip for user-created custom questions', () => {
      const customQ = createCustomInterviewQuestion(
        'Paano mo hina-handle ang database failover kapag nag-crash ang primary server?',
        'High Availability & Disaster Recovery',
        'Engineering Reliability'
      );

      renderInterviewQuestions([customQ]);

      const list = document.getElementById('interviewQuestionsList');
      expect(list.innerHTML).toContain('Custom Question');
      expect(list.innerHTML).toContain('High Availability &amp; Disaster Recovery');
    });

    test('openFirstDrawer option automatically unhides Question 1 practice drawer', () => {
      renderInterviewQuestions([mockQuestion], { openFirstDrawer: true });

      const list = document.getElementById('interviewQuestionsList');
      const drawer = list.querySelector('.practice-drawer');
      const toggleLabel = list.querySelector('.btn-toggle-label');

      expect(drawer.classList.contains('hidden')).toBe(false);
      expect(toggleLabel.textContent).toBe('Hide Practice Drawer');
    });

    test('evaluates synthetic question and renders interactive loop-around round 2 challenge', () => {
      const syntheticQuestion = {
        id: 1,
        category: 'Concurrency & Distributed Systems',
        target_skill: 'Distributed Locking & Redis',
        question: 'Paano mo hina-handle ang race condition sa high-concurrency wallet transactions?',
        question_tagalog: 'Paano mo pinamamahalaan ang race condition sa mataas na concurrency ng transaksyon sa wallet?',
        interviewer_intent: 'Tinitingnan kung paano nagpapatupad ng distributed locks gamit ang Redis.',
        talking_points: ['Distributed locking (Redlock)', 'Database transaction isolation', 'Idempotency key'],
        loop_around_prompts: {
          taglish: 'Paano mo masisiguro na hindi magkakaroon ng double-deduction kung sakaling mag-timeout ang Redis client sa kalagitnaan ng wallet transfer?'
        },
        is_synthetic: true
      };

      renderInterviewQuestions([syntheticQuestion], { openFirstDrawer: true });

      const list = document.getElementById('interviewQuestionsList');
      const input = list.querySelector('.practice-input');
      const evalBtn = list.querySelector('.btn-eval-answer');
      const feedback = list.querySelector('.practice-feedback');

      // Provide partial answer to trigger active loop-around
      input.value = 'Gumagamit kami ng distributed locks gamit ang Redis para walang sumabay na transaction.';
      evalBtn.click();

      expect(feedback.classList.contains('hidden')).toBe(false);
      expect(feedback.innerHTML).toContain('Conversational Loop-Around Drill (Round 2)');
      expect(feedback.innerHTML).toContain('Submit Loop-Around Response');

      // Test Round 2 input submission
      const r2Input = feedback.querySelector('.loop-round-input');
      const r2Btn = feedback.querySelector('.btn-submit-loop-around');
      expect(r2Input).toBeTruthy();
      expect(r2Btn).toBeTruthy();

      r2Input.value = 'Para maiwasan ang double-deduction kapag nag-timeout, naglagay kami ng unique idempotency key sa PostgreSQL na may SERIALIZABLE isolation at retry mechanism kaya naging 0 ang ledger discrepancies.';
      r2Btn.click();

      const r2Result = feedback.querySelector('.loop-round-result');
      expect(r2Result.classList.contains('hidden')).toBe(false);
      expect(r2Result.textContent).toContain('Loop Mastered!');
      expect(r2Result.textContent).toContain('Round 2 Complete');
    });
  });
});
