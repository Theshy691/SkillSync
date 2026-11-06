/** @jest-environment jsdom */
const fs = require('fs');
const vm = require('vm');
const {
  initStudioPresets, undoWorkspaceReplacement, switchResumeVersion,
  deleteResumeVersion, setResumeVersions, getResumeVersions
} = require('../script.js');

beforeEach(() => {
  document.body.innerHTML = `
    <textarea id="resumeText"></textarea><span id="resumeCount"></span>
    <textarea id="jobText"></textarea><span id="jobCount"></span>
    <button id="sampleResumeSweBtn"></button><button id="clearResumeBtn"></button>
    <select id="resumeVersionSelect"></select><button id="undoWorkspaceBtn" disabled></button>
    <div id="toast-container"></div>`;
  localStorage.clear();
  setResumeVersions([
    { id: 'first', name: 'First', content: 'Original profile' },
    { id: 'second', name: 'Second', content: 'Other profile' }
  ]);
});

test('clear and sample replacement can recover the actual working resume', () => {
  initStudioPresets();
  const field = document.getElementById('resumeText');
  field.value = 'My unsaved experience';
  document.getElementById('sampleResumeSweBtn').click();
  expect(field.value).not.toBe('My unsaved experience');
  undoWorkspaceReplacement();
  expect(field.value).toBe('My unsaved experience');
  document.getElementById('clearResumeBtn').click();
  expect(field.value).toBe('');
  undoWorkspaceReplacement();
  expect(field.value).toBe('My unsaved experience');
});

test('the single sample action works without preset chips and undoes both documents together', () => {
  document.getElementById('sampleResumeSweBtn').remove();
  const button = document.createElement('button');
  button.id = 'loadSamplePairBtn';
  document.body.appendChild(button);
  const resume = document.getElementById('resumeText');
  const job = document.getElementById('jobText');
  resume.value = 'My actual experience'; job.value = 'My target role';
  initStudioPresets();
  button.click();
  expect(resume.value).toContain('Full-Stack Software Engineer');
  expect(job.value).toContain('Staff Full-Stack Software Engineer');
  undoWorkspaceReplacement();
  expect(resume.value).toBe('My actual experience');
  expect(job.value).toBe('My target role');
});

test('profile switching and deletion preserve a recoverable working copy', () => {
  const field = document.getElementById('resumeText');
  field.value = 'Edited profile with new accomplishments';
  field.dataset.profileId = 'first';
  switchResumeVersion('second');
  undoWorkspaceReplacement();
  expect(field.value).toBe('Edited profile with new accomplishments');
  expect(field.dataset.profileId).toBe('first');
  deleteResumeVersion('first');
  expect(getResumeVersions()).toHaveLength(1);
  undoWorkspaceReplacement();
  expect(getResumeVersions()).toHaveLength(2);
  expect(field.value).toBe('Edited profile with new accomplishments');
});

test('tab drafts restore only for their owner and are removed on sign out', async () => {
  sessionStorage.clear();
  const context = {
    document, Event, console: { error() {}, warn() {}, info() {} },
    localStorage, sessionStorage, setTimeout, clearTimeout,
    requestAnimationFrame: callback => callback()
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../script.js'), 'utf8'), context);
  vm.runInContext("currentSession = {user: {id: 'first-user'}}; initWorkspaceDrafts();", context);
  const field = document.getElementById('resumeText');
  field.value = 'Private first-user draft';
  field.dispatchEvent(new Event('input'));
  vm.runInContext("currentSession = {user: {id: 'second-user'}}; initWorkspaceDrafts();", context);
  expect(field.value).toBe('');
  expect(document.getElementById('resumeCount').textContent).toBe('0 chars');
  vm.runInContext("currentSession = {user: {id: 'first-user'}}; initWorkspaceDrafts();", context);
  expect(field.value).toBe('Private first-user draft');
  await context.performSignOut();
  expect(sessionStorage.getItem('skillsync_workspace_draft:first-user')).toBeNull();
  expect(field.value).toBe('');
});

test('delayed authentication restores a resume without overwriting an incoming job', () => {
  sessionStorage.clear();
  sessionStorage.setItem('skillsync_workspace_draft:delayed-user', JSON.stringify({
    resume: 'Saved resume', job: 'Previous target role', profileId: ''
  }));
  const context = {
    document, Event, console: { error() {}, warn() {}, info() {} },
    localStorage, sessionStorage, setTimeout, clearTimeout,
    requestAnimationFrame: callback => callback()
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../script.js'), 'utf8'), context);
  context.replaceWorkspaceText('jobText', 'New role imported from discovery');
  vm.runInContext("currentSession = {user: {id: 'delayed-user'}}; initWorkspaceDrafts();", context);
  expect(document.getElementById('resumeText').value).toBe('Saved resume');
  expect(document.getElementById('jobText').value).toBe('New role imported from discovery');
  expect(JSON.parse(sessionStorage.getItem('skillsync_workspace_draft:delayed-user')).job)
    .toBe('New role imported from discovery');
});
