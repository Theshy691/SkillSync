/** @jest-environment jsdom */
const { calculateDemoMatch } = require('../script.js');

test('demo reports observed keywords without inventing gaps or a minimum score', () => {
  expect(calculateDemoMatch('React Docker', 'React Docker').missing_skills).toEqual([]);
  expect(calculateDemoMatch('React Docker', 'React Docker').match_score).toBe(100);
  expect(calculateDemoMatch('Designer', 'React Docker').match_score).toBe(0);
  expect(calculateDemoMatch('JavaScript', 'Java').missing_skills).toEqual(['Java']);
  expect(calculateDemoMatch('Going to work', 'Go').missing_skills).toEqual(['Go']);
  expect(calculateDemoMatch('Resume', 'Unrecognized role').demo_skill_count).toBe(0);
});
