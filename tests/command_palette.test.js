/**
 * @file tests/command_palette.test.js
 * Comprehensive unit test suite for the Global Command Palette Module
 */

const SkillSyncCommandPalette = require('../assets/js/modules/command_palette.js');

describe('Global Command Palette Engine Test Suite', () => {
  beforeEach(() => {
    SkillSyncCommandPalette.resetRegistry();
  });

  test('DEFAULT_COMMANDS contains core workspace actions with shortcuts', () => {
    const list = SkillSyncCommandPalette.DEFAULT_COMMANDS;
    expect(list.length).toBeGreaterThanOrEqual(8);

    const scanCmd = list.find(c => c.id === 'run_scan');
    expect(scanCmd).toBeDefined();
    expect(scanCmd.shortcut).toContain('↵');

    const agenticCmd = list.find(c => c.id === 'agentic_request');
    expect(agenticCmd).toBeDefined();
    expect(agenticCmd.category).toBe('Autonomous AI');

    const speedrunCmd = list.find(c => c.id === 'speedrun_kit');
    expect(speedrunCmd).toBeDefined();
  });

  test('filterCommands returns all commands when query is empty', () => {
    const results = SkillSyncCommandPalette.filterCommands('');
    expect(results.length).toBe(SkillSyncCommandPalette.DEFAULT_COMMANDS.length);
  });

  test('filterCommands matches titles and keywords accurately', () => {
    const interviewResults = SkillSyncCommandPalette.filterCommands('tagalog');
    expect(interviewResults.length).toBeGreaterThan(0);
    expect(interviewResults[0].id).toBe('mock_interview');

    const salaryResults = SkillSyncCommandPalette.filterCommands('negotiate');
    expect(salaryResults.length).toBeGreaterThan(0);
    expect(salaryResults[0].id).toBe('salary_coach');
  });

  test('registerCommand allows adding custom actions to palette', () => {
    SkillSyncCommandPalette.registerCommand({
      id: 'custom_export_pdf',
      title: 'Export Tailored Resume to PDF',
      category: 'Export',
      keywords: ['pdf', 'print', 'download']
    });

    const results = SkillSyncCommandPalette.filterCommands('export');
    expect(results.some(c => c.id === 'custom_export_pdf')).toBe(true);
  });

  test('renderCommandListHtml renders highlighted item and empty fallback', () => {
    const commands = SkillSyncCommandPalette.DEFAULT_COMMANDS.slice(0, 4);
    const html = SkillSyncCommandPalette.renderCommandListHtml(commands, 1);

    expect(html).toContain('is-selected');
    expect(html).toContain('data-command-id="agentic_request"');
    expect(html).toContain('data-command-id="speedrun_kit"');

    const emptyHtml = SkillSyncCommandPalette.renderCommandListHtml([]);
    expect(emptyHtml).toContain('No matching commands found');
  });
});
