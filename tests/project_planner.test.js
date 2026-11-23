const { compareJobs, chooseProject, extractSkills } = require('../assets/js/modules/project_planner');

const postings = [
  { id: 'a', description: 'Minimum qualifications:\n- Docker and GitHub Actions.\nPreferred qualifications:\n- K8s and Redis.' },
  { id: 'b', description: 'Requirements: Docker and Kubernetes\nNice to have:\n- GitHub Actions.' },
  { id: 'c', description: 'Responsibilities:\n- Run Docker workloads.' }
];

test('preserves posting lines, counts distinct roles and classifies explicit priorities', () => {
  const { recurring } = compareJobs(postings);
  expect(recurring.map(item => item.skill)).toEqual(['docker', 'github actions', 'kubernetes']);
  expect(recurring[1].mentions.map(({ priority, line }) => [priority, line])).toEqual([
    ['required', '- Docker and GitHub Actions.'], ['preferred', '- GitHub Actions.']
  ]);
  expect(recurring[0].mentions[2].priority).toBe('mentioned');
});

test('selects project steps within budget and observes step prerequisites', () => {
  const { recurring } = compareJobs(postings);
  expect(chooseProject(recurring, 2)).toBeNull();
  expect(chooseProject(recurring, 5)).toMatchObject({
    hours: 5, roleCount: 3, steps: [{ skills: ['docker'] }, { skills: ['github actions', 'ci/cd'] }]
  });
  expect(chooseProject(recurring, 8).steps).toHaveLength(3);
  const { recurring: covered } = compareJobs(postings, ['docker', 'github actions']);
  expect(chooseProject(covered, 4)).toBeNull();
  expect(chooseProject(covered, 6).requirements.map(item => item.skill)).toEqual(['kubernetes']);
});

test('recognizes technology aliases without counting related names as separate skills', () => {
  expect(extractSkills('Vue, Vue.js, Node.js, Go, Golang, K8s, React Native, C++ and SQL')).toEqual([
    'vue.js', 'node.js', 'go', 'kubernetes', 'react native', 'c++', 'sql'
  ]);
  expect(compareJobs([{ id: 'a', description: 'Docker. Docker.' }, { id: 'b' }]).recurring).toEqual([]);
});
