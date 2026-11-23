/** @jest-environment jsdom */

const fs = require('node:fs');
const path = require('node:path');
const planner = require('../assets/js/modules/project_planner');
const uiSource = fs.readFileSync(path.join(__dirname, '../assets/js/modules/project_planner_ui.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');

test('adds a description to an older role, saves project evidence and restores the review', () => {
  localStorage.clear();
  document.body.innerHTML = html.match(/<details id="projectPlanner"[\s\S]*?<\/details>/)[0];
  window.SkillSyncProjectPlanner = planner;
  window.eval(uiSource);
  const panel = document.getElementById('projectPlanner');
  const jobs = [
    { id: 'older', title: '<img src=x>', company_name: 'One' },
    { id: 'new', title: 'Platform Engineer', company_name: 'Two', description: 'Required: Docker' }
  ];
  const actions = {
    getJobs: () => jobs,
    getSkills: () => [],
    saveDescription: jest.fn((id, text) => {
      jobs.find(job => job.id === id).description = text;
      return true;
    }),
    refreshEvidence: jest.fn(),
    openRole: jest.fn()
  };
  const ui = window.SkillSyncProjectPlannerUI;
  ui.mount(panel, actions);
  expect(panel.querySelector('img')).toBeNull();
  expect(panel.querySelector('button[type=submit]').disabled).toBe(true);
  panel.querySelector('textarea').value = 'Preferred: Docker';
  panel.querySelector('#projectPlannerRoles button').click();
  panel.querySelectorAll('input[type=checkbox]')[1].click();
  panel.querySelector('button[type=submit]').click();
  const result = panel.querySelector('#projectPlannerResult');
  expect(result.textContent).toContain('Make an existing app reproducible');
  expect(result.textContent).toContain('Preferred: Docker');
  result.querySelector('textarea').value = 'Packaged my demo app in Docker.';
  result.querySelector('button[type=submit]').click();
  expect(actions.refreshEvidence).toHaveBeenCalledTimes(1);
  expect(ui.readEvidence()[0].extracted_skills).toEqual(['Docker']);
  expect(result.textContent).toContain('0 → 1 of 1 recognized skills');
  result.querySelector('button').click();
  expect(actions.openRole).toHaveBeenCalledWith(expect.objectContaining({ id: 'older' }),
    expect.objectContaining({ doc_type: 'project' }));

  document.body.innerHTML = html.match(/<details id="projectPlanner"[\s\S]*?<\/details>/)[0];
  ui.mount(document.getElementById('projectPlanner'), actions);
  expect(document.getElementById('projectPlannerReview').textContent).toContain('Review coverage');
});
