(function (root) {
  'use strict';

  const planner = root.SkillSyncProjectPlanner;
  const selectionKey = 'skillsync_project_plan';
  const evidenceKey = 'skillsync_project_evidence';

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function readEvidence() {
    const records = read(evidenceKey);
    return Array.isArray(records) ? records.filter(record =>
      record && typeof record.id === 'string' && record.id.startsWith('planner-project-') && record.doc_type === 'project' &&
      typeof record.doc_name === 'string' && typeof record.content_snippet === 'string' &&
      Array.isArray(record.extracted_skills) && record.extracted_skills.every(skill => typeof skill === 'string')) : [];
  }

  function writeEvidence(records) {
    try {
      localStorage.setItem(evidenceKey, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }

  function element(tag, value) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function button(label, className = 'quiet-button') {
    const node = element('button', label);
    node.className = className;
    node.type = 'button';
    return node;
  }

  function mount(panel, actions) {
    const form = panel.querySelector('form');
    const rolesList = panel.querySelector('#projectPlannerRoles');
    const budget = panel.querySelector('#projectPlannerBudget');
    const output = panel.querySelector('#projectPlannerResult');
    const status = panel.querySelector('#projectPlannerStatus');
    const submit = form.querySelector('[type=submit]');
    let selected = new Set();
    let plan = read(selectionKey);
    if (!Array.isArray(plan?.ids) || !Array.isArray(plan?.baseline) || !Number.isInteger(plan.hours)) plan = null;
    let jobDescriptions = new Map();

    function clearResult() {
      plan = null;
      output.replaceChildren();
      try { localStorage.removeItem(selectionKey); } catch {}
    }

    function updateRoles() {
      const jobs = actions.getJobs();
      const current = new Map(jobs.map(job => [String(job.id), typeof job.description === 'string' ? job.description.trim() : '']));
      selected = new Set([...selected].filter(id => current.get(id)));
      if (plan && plan.ids.some(id => current.get(id) !== jobDescriptions.get(id))) clearResult();
      jobDescriptions = current;

      rolesList.replaceChildren();
      submit.disabled = [...current.values()].filter(Boolean).length < 2;
      if (!jobs.length) {
        rolesList.append(element('p', 'Add two applications with job descriptions to start a comparison.'));
        return;
      }

      for (const job of jobs) {
        const id = String(job.id);
        const row = element('div');
        row.className = 'project-planner-role';
        const label = element('label');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selected.has(id);
        checkbox.disabled = !current.get(id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(id);
          else selected.delete(id);
          clearResult();
          status.textContent = '';
        });
        label.append(checkbox, element('span', `${job.title} · ${job.company_name}`));
        row.append(label);
        if (checkbox.disabled) {
          const editor = element('details');
          const textarea = element('textarea');
          const inputLabel = element('label', `Job description for ${job.title}`);
          textarea.className = 'console-input';
          textarea.maxLength = 30000;
          textarea.rows = 4;
          inputLabel.append(textarea);
          const save = button('Save description');
          save.addEventListener('click', () => {
            if (!textarea.value.trim()) {
              status.textContent = 'Paste the job description before saving.';
              textarea.focus();
              return;
            }
            if (!actions.saveDescription(job.id, textarea.value.trim())) {
              status.textContent = 'The description could not be saved. Try again.';
              return;
            }
            selected.add(id);
            updateRoles();
            status.textContent = 'Job description saved.';
            rolesList.querySelectorAll('input')[jobs.indexOf(job)]?.focus();
          });
          editor.append(element('summary', 'Add job description'), inputLabel, save);
          row.append(editor);
        }
        rolesList.append(row);
      }
    }

    function render() {
      output.replaceChildren();
      if (!plan) return;
      const jobs = actions.getJobs().filter(job => plan.ids.includes(String(job.id)));
      const comparison = planner.compareJobs(jobs, plan.baseline);
      const project = planner.chooseProject(comparison.recurring, plan.hours);
      const evidence = readEvidence().find(record => record.id === plan.id);

      if (project) {
        output.append(element('h3', project.title),
          element('p', `About ${project.hours} hours · ${project.roleCount} of ${jobs.length} roles with a gap this project addresses`));
        const steps = element('ol');
        steps.append(element('li', `${project.start} (About ${project.setupHours} h)`));
        for (const step of project.steps) {
          const skills = step.skills.map(planner.skillLabel).join(', ');
          steps.append(element('li', `${step.task} (${skills} · about ${step.hours} h)`));
        }
        output.append(steps);
      } else {
        output.append(element('p', comparison.recurring.length
          ? comparison.recurring.every(requirement => requirement.covered)
            ? 'Your resume and documents already cover every recurring skill recognized in these postings.'
            : 'No project fits the shared gaps and time budget. Try a larger budget or a different group of roles.'
          : 'No recurring technical skills were recognized in these postings. Try comparing a different group of roles.'));
      }

      if (comparison.recurring.length) {
        output.append(element('h3', 'Recurring skills'));
        for (const requirement of comparison.recurring) {
          const details = element('details');
          const title = `${planner.skillLabel(requirement.skill)} · ${requirement.mentions.length} of ${jobs.length} roles`;
          details.append(element('summary', title + (requirement.covered ? ' · Already in your documents' : '')));
          const citations = element('ul');
          for (const mention of requirement.mentions) {
            const citation = element('li');
            const priority = { required: 'Required', preferred: 'Preferred', mentioned: 'Priority unspecified' };
            citation.append(element('strong', `${mention.role.title} · ${mention.role.company_name} · ${priority[mention.priority]}`),
              element('blockquote', mention.line));
            citations.append(citation);
          }
          details.append(citations);
          output.append(details);
        }
      }

      if (!project) return;
      if (!evidence) {
        const evidenceForm = element('form');
        const label = element('label', 'What did you build?');
        const notes = element('textarea');
        notes.className = 'console-input';
        notes.required = true;
        notes.maxLength = 2000;
        notes.rows = 3;
        notes.placeholder = 'Describe what you completed, the tools you used, and optionally add a link.';
        label.append(notes);
        const save = button('Save completed project to Documents', 'ss-button ss-button-secondary');
        save.type = 'submit';
        evidenceForm.append(label, save);
        evidenceForm.addEventListener('submit', event => {
          event.preventDefault();
          const text = notes.value.trim();
          const projectSkills = new Set(project.steps.flatMap(step => step.skills));
          const skills = planner.extractSkills(text).filter(skill => projectSkills.has(skill));
          if (!skills.length) {
            status.textContent = 'Describe your work and name at least one technology from the project steps.';
            notes.focus();
            return;
          }
          const record = {
            id: plan.id, doc_type: 'project', doc_name: project.title, content_snippet: text,
            extracted_skills: skills.map(planner.skillLabel), created_at: new Date().toISOString().slice(0, 10)
          };
          const records = readEvidence().filter(item => item.id !== record.id);
          if (!writeEvidence([record, ...records])) {
            status.textContent = 'The project could not be saved. Your notes are still here.';
            return;
          }
          actions.refreshEvidence();
          status.textContent = 'Project saved to Documents. Review the updated coverage by role.';
          render();
          output.querySelector('#projectPlannerReview')?.focus();
        });
        output.append(evidenceForm);
      } else {
        const review = element('h3', 'Review coverage after the project');
        review.id = 'projectPlannerReview';
        review.tabIndex = -1;
        output.append(review, element('p', 'Coverage counts recognized technologies in each posting and in your documents.'));
        const baseline = new Set(plan.baseline);
        const additions = new Set(planner.extractSkills(evidence.extracted_skills.join(', ')));
        for (const role of comparison.roles) {
          const gained = role.requirements.filter(({ skill }) => additions.has(skill) && !baseline.has(skill));
          const before = role.requirements.filter(({ skill }) => baseline.has(skill)).length;
          const total = role.requirements.length;
          const row = element('div');
          row.className = 'project-planner-role';
          row.append(element('strong', `${role.title} · ${role.company_name}`),
            element('p', total ? `${before} → ${before + gained.length} of ${total} recognized skills` : 'No recognized skills in this posting.'));
          if (gained.length) row.append(element('p', gained.map(({ skill }) => planner.skillLabel(skill)).join(', ')));
          const open = button('Compare with this project');
          open.addEventListener('click', () => actions.openRole(role, evidence));
          row.append(open);
          output.append(row);
        }
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (selected.size < 2) {
        status.textContent = 'Select at least two roles with job descriptions.';
        return;
      }
      plan = { ids: [...selected], hours: Number(budget.value), baseline: actions.getSkills(),
        id: 'planner-project-' + (root.crypto.randomUUID?.() || Date.now()) };
      try {
        localStorage.setItem(selectionKey, JSON.stringify(plan));
        status.textContent = 'Comparison ready.';
      } catch {
        status.textContent = 'Comparison ready. This browser could not keep the plan after reload.';
      }
      render();
      output.focus();
    });

    budget.addEventListener('change', () => {
      clearResult();
      status.textContent = '';
    });
    if (plan) {
      selected = new Set(plan.ids);
      budget.value = plan.hours;
      jobDescriptions = new Map(actions.getJobs().map(job => [String(job.id), String(job.description || '').trim()]));
      if (plan.ids.some(id => !jobDescriptions.get(id))) clearResult();
    }
    updateRoles();
    render();

    panel.addEventListener('toggle', () => {
      if (panel.open) updateRoles();
    });
    return function refresh(evidenceChanged = false) {
      if (panel.open) updateRoles();
      if (evidenceChanged) render();
    };
  }

  root.SkillSyncProjectPlannerUI = { mount, readEvidence, writeEvidence };
})(globalThis);
