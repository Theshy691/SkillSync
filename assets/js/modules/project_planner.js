/**
 * Compare saved postings and choose a portfolio project within a time budget.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./taxonomy'));
  } else {
    root.SkillSyncProjectPlanner = factory(root.SkillSyncTaxonomy);
  }
})(globalThis, function (taxonomy) {
  'use strict';

  const aliases = {
    react: ['React'], 'react native': ['React Native'], 'next.js': ['Next.js', 'NextJS'],
    'vue.js': ['Vue.js', 'Vue'], angular: ['Angular'], svelte: ['Svelte'],
    typescript: ['TypeScript'], javascript: ['JavaScript'], html5: ['HTML5', 'HTML'],
    css3: ['CSS3', 'CSS'], 'tailwind css': ['Tailwind CSS', 'Tailwind'],
    'node.js': ['Node.js', 'NodeJS', 'Node'], express: ['Express.js', 'ExpressJS', 'Express'],
    python: ['Python'], fastapi: ['FastAPI'], django: ['Django'], flask: ['Flask'],
    php: ['PHP'], laravel: ['Laravel'], ruby: ['Ruby'], go: ['Golang', 'Go'],
    rust: ['Rust'], 'c++': ['C++'], java: ['Java'],
    postgresql: ['PostgreSQL', 'Postgres'], mysql: ['MySQL'], mongodb: ['MongoDB'],
    redis: ['Redis'], sqlite: ['SQLite'], docker: ['Docker'], kubernetes: ['Kubernetes', 'K8s'],
    terraform: ['Terraform'], aws: ['AWS', 'Amazon Web Services'], gcp: ['GCP', 'Google Cloud Platform'],
    azure: ['Azure'], 'ci/cd': ['CI/CD', 'CI / CD', 'continuous integration'],
    graphql: ['GraphQL'], 'rest api': ['REST APIs', 'REST API', 'RESTful API', 'REST'],
    kafka: ['Kafka'], playwright: ['Playwright'], jest: ['Jest'], linux: ['Linux'], git: ['Git'],
    'github actions': ['GitHub Actions'], sql: ['SQL']
  };

  const terms = [...new Set([
    ...Object.values(aliases).flat(),
    ...taxonomy.SKILL_KEYWORDS_TAXONOMY.filter(skill => !Object.hasOwn(aliases, skill))
  ])].sort((left, right) => right.length - left.length);
  const canonical = new Map(Object.entries(aliases).flatMap(([skill, names]) =>
    names.map(name => [name.toLowerCase(), skill])));
  const pattern = new RegExp(
    '(?<![\\w+#])(?:' + terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w+#])',
    'gi'
  );

  const projects = [
    { title: 'Make an existing app reproducible', hours: 1, start: 'Start with a small app that already runs locally.', steps: [
      { hours: 2, skills: ['docker'], task: 'Package the app in Docker and document the command that starts it.' },
      { hours: 2, skills: ['github actions', 'ci/cd'], task: 'Run the app’s tests on every push with GitHub Actions and document the result.' },
      { hours: 3, requires: 'docker', skills: ['kubernetes'], task: 'Deploy the container to a local Kubernetes cluster and document the health check and rollback.' }
    ] },
    { title: 'Build a small searchable API', hours: 2, start: 'Build a small API with one endpoint and a few sample records.', steps: [
      { hours: 3, skills: ['postgresql', 'sql'], task: 'Store records in PostgreSQL, add an index, and capture an EXPLAIN plan.' },
      { hours: 2, skills: ['redis'], task: 'Cache a read in Redis and show how a record update invalidates it.' },
      { hours: 2, skills: ['rest api'], task: 'Document and test the REST endpoint, including an invalid request.' }
    ] },
    { title: 'Build and test a typed web interface', hours: 2, start: 'Start with a small React and TypeScript app that reads sample data.', steps: [
      { hours: 2, skills: ['react', 'typescript'], task: 'Build a typed filterable view and document its loading and empty states.' },
      { hours: 2, skills: ['playwright'], task: 'Use Playwright to test the main flow and one edge case.' },
      { hours: 2, skills: ['next.js'], task: 'Add a Next.js route and document where the page loads its data.' }
    ] }
  ];

  function extractSkills(text) {
    return [...new Set((String(text || '').match(pattern) || [])
      .map(match => canonical.get(match.toLowerCase()) || match.toLowerCase()))];
  }

  function skillLabel(skill) {
    return aliases[skill]?.[0] || skill;
  }

  function priorityFor(text, heading = 'mentioned') {
    if (/\b(preferred|nice[- ]to[- ]have|bonus|desirable|a plus|optional)\b/i.test(text)) return 'preferred';
    if (/\b(required|requirements?|minimum|must[- ]have|mandatory|essential)\b/i.test(text)) return 'required';
    return heading;
  }

  function readRequirements(description = '') {
    const requirements = new Map();
    let heading = 'mentioned';
    const priorityOrder = { required: 2, preferred: 1, mentioned: 0 };
    for (const source of description.split(/\r?\n/)) {
      const line = source.trim();
      if (!line) continue;
      const possibleHeader = line.match(/^(?:(.{1,65}):\s*(.*)|((?:minimum |preferred )?qualifications|(?:technical )?requirements|responsibilities|preferred skills|nice to have|what you.ll do))$/i);
      const header = possibleHeader && !extractSkills(possibleHeader[1] || possibleHeader[3]).length ? possibleHeader : null;
      if (header) heading = priorityFor(header[1] || header[3]);
      const body = header ? header[2] || '' : line;
      const clauses = body.split(/(?<=[.!?;])\s+/);
      for (const clause of clauses) {
        const priority = priorityFor(clause, heading);
        for (const skill of extractSkills(clause)) {
          const existing = requirements.get(skill);
          if (!existing || priorityOrder[priority] > priorityOrder[existing.priority]) {
            requirements.set(skill, { skill, priority, line });
          }
        }
      }
    }
    return [...requirements.values()];
  }

  function compareJobs(jobs, existingSkills = []) {
    const covered = new Set(existingSkills);
    const roles = jobs.map(job => ({ ...job, requirements: readRequirements(job.description) }));
    const bySkill = new Map();
    for (const role of roles) {
      for (const requirement of role.requirements) {
        if (!bySkill.has(requirement.skill)) bySkill.set(requirement.skill, []);
        bySkill.get(requirement.skill).push({ role, ...requirement });
      }
    }
    const recurring = [...bySkill].filter(([, mentions]) => mentions.length > 1)
      .map(([skill, mentions]) => ({ skill, mentions, covered: covered.has(skill) }))
      .sort((left, right) => right.mentions.length - left.mentions.length ||
        left.skill.localeCompare(right.skill));
    return { roles, recurring };
  }

  function chooseProject(recurring, budget) {
    const gaps = recurring.filter(requirement => !requirement.covered);
    const choices = projects.flatMap(project => {
      // Try every step combination. Starting the project has a fixed setup cost.
      return Array.from({ length: 2 ** project.steps.length - 1 }, (_, index) => {
        const steps = project.steps.filter((_, position) => (index + 1) & (1 << position));
        if (steps.some(step => step.requires &&
          !steps.some(candidate => candidate.skills.includes(step.requires)))) return null;
        const hours = project.hours + steps.reduce((total, step) => total + step.hours, 0);
        const skills = new Set(steps.flatMap(step => step.skills));
        const requirements = gaps.filter(gap => skills.has(gap.skill));
        const mentions = requirements.flatMap(requirement => requirement.mentions);
        const roleCount = new Set(mentions.map(mention => mention.role.id)).size;
        const requiredCount = mentions.filter(mention => mention.priority === 'required').length;
        return { title: project.title, start: project.start, setupHours: project.hours,
          steps, hours, roleCount, requiredCount, requirements };
      });
    });

    return choices.filter(choice => choice?.roleCount && choice.hours <= budget)
      .sort((left, right) => right.roleCount - left.roleCount ||
        right.requiredCount - left.requiredCount ||
        right.requirements.length - left.requirements.length || left.hours - right.hours)[0] || null;
  }

  return { extractSkills, skillLabel, compareJobs, chooseProject };
});
