/**
 * @jest-environment jsdom
 */

const { initAnalyzer } = require('../script');

describe('Keyboard Shortcuts & Studio Navigation Test Suite', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="results-skeleton" class="hidden"></div>
      <div id="results-container" class="hidden"></div>
      <button id="analyzeBtn">
        <span id="analyzeBtnText">Run Match Analysis</span>
        <span id="analyzeSpinner" class="hidden"></span>
      </button>
      <textarea id="resumeText"></textarea>
      <textarea id="jobText"></textarea>
    `;
  });

  test('Cmd+Enter in resume textarea triggers analyze button click', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resumeText = document.getElementById('resumeText');
    const clickSpy = jest.spyOn(analyzeBtn, 'click');

    initAnalyzer();

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true
    });

    resumeText.dispatchEvent(event);
    expect(clickSpy).toHaveBeenCalled();
  });

  test('Ctrl+Enter in job textarea triggers analyze button click', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const jobText = document.getElementById('jobText');
    const clickSpy = jest.spyOn(analyzeBtn, 'click');

    initAnalyzer();

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });

    jobText.dispatchEvent(event);
    expect(clickSpy).toHaveBeenCalled();
  });

  test('regular Enter does not trigger analyze click', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resumeText = document.getElementById('resumeText');
    const clickSpy = jest.spyOn(analyzeBtn, 'click');

    initAnalyzer();

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: false,
      ctrlKey: false,
      bubbles: true
    });

    resumeText.dispatchEvent(event);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
