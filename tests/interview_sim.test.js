/**
 * @jest-environment jsdom
 */

const {
  evaluateInterviewAnswer,
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
    ]
  };

  describe('Answer Evaluation Algorithm', () => {
    test('rates strong answer covering talking points with metrics as Exceptional Delivery', () => {
      const userAnswer = `In our production system, we prevent cache stampedes by combining distributed mutex locking in Redis with probabilistic early expiration. When keys approach TTL, we trigger a stale-while-revalidate background worker, reducing API latency by 45% and optimizing database throughput.`;

      const result = evaluateInterviewAnswer(mockQuestion, userAnswer);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('Exceptional Delivery');
      expect(result.coveredPoints.length).toBeGreaterThanOrEqual(2);
      expect(result.critique).toContain('Excellent response');
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

  describe('Interactive Practice Drawer UI', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="interviewQuestionsList"></div>
        <div id="toast-container"></div>
      `;
    });

    test('renderInterviewQuestions renders practice drawer and evaluates answer interactively', () => {
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
    });
  });
});
