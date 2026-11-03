/**
 * SkillSync - Global Raycast-Grade Command Palette Engine (Cmd + K)
 * File: assets/js/modules/command_palette.js
 *
 * Provides a universal spotlight command palette with keyboard navigation,
 * fuzzy action search, and instant execution across workspace features.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SkillSyncCommandPalette = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_COMMANDS = [
    {
      id: 'run_scan',
      title: 'Analyze ATS Match (Resume vs Job)',
      category: 'Analysis',
      shortcut: '⌘ ↵',
      keywords: ['scan', 'evaluate', 'ats', 'match', 'score', 'audit']
    },
    {
      id: 'audit_credibility',
      title: 'Audit Resume Credibility & Anti-Hallucination',
      category: 'Audit',
      shortcut: '⌘ A',
      keywords: ['audit', 'fake', 'credibility', 'integrity', 'fact-check', 'anachronism']
    },
    {
      id: 'agentic_request',
      title: '1-Click Agentic Company Request',
      category: 'Autonomous AI',
      shortcut: '⌘ S',
      keywords: ['agentic', 'company', 'request', 'apply', 'dispatch', 'autonomous', '1-click', 'speedrun']
    },
    {
      id: 'speedrun_kit',
      title: '1-Click Speedrun Application Kit',
      category: 'Accelerator',
      shortcut: '⌘ S',
      keywords: ['speedrun', 'kit', 'tailor', 'cover letter', 'outreach', 'apply']
    },
    {
      id: 'mock_interview',
      title: 'Interview Simulator (Tagalog / Taglish / English & Loop-Around)',
      category: 'Practice',
      shortcut: '⌘ I',
      keywords: ['interview', 'tagalog', 'taglish', 'questions', 'star', 'practice', 'loop', 'synthetic']
    },
    {
      id: 'import_url',
      title: 'Import Target Job from URL',
      category: 'Workspace',
      shortcut: '⌘ U',
      keywords: ['scrape', 'url', 'linkedin', 'upwork', 'indeed', 'import']
    },
    {
      id: 'salary_coach',
      title: 'Salary Benchmark & Negotiation Coach',
      category: 'Career',
      shortcut: '⌘ B',
      keywords: ['salary', 'compensation', 'offer', 'counter', 'money', 'negotiate']
    },
    {
      id: 'skill_vault',
      title: 'Open Candidate Skill Vault & Taxonomy',
      category: 'Profile',
      shortcut: '⌘ V',
      keywords: ['vault', 'skills', 'certifications', 'documents', 'pdf']
    },
    {
      id: 'pipeline_board',
      title: 'View Kanban Application Pipeline',
      category: 'Tracking',
      shortcut: '⌘ P',
      keywords: ['pipeline', 'kanban', 'jobs', 'tracking', 'status', 'follow up']
    },
    {
      id: 'job_discovery',
      title: 'Browse Live Remote Job Offers',
      category: 'Explorer',
      shortcut: '⌘ J',
      keywords: ['jobs', 'remote', 'feed', 'discovery', 'radar']
    },
    {
      id: 'toggle_theme',
      title: 'Toggle Theme (Dark / Warm Paper)',
      category: 'Preferences',
      shortcut: '⌘ T',
      keywords: ['theme', 'dark', 'light', 'mode', 'color']
    }
  ];

  let commandRegistry = [...DEFAULT_COMMANDS];

  /**
   * Resets registry to default commands
   */
  function resetRegistry() {
    commandRegistry = [...DEFAULT_COMMANDS];
  }

  /**
   * Registers a custom command into the palette
   * @param {Object} cmd
   */
  function registerCommand(cmd) {
    if (!cmd || !cmd.id || !cmd.title) return;
    const existingIdx = commandRegistry.findIndex(c => c.id === cmd.id);
    if (existingIdx !== -1) {
      commandRegistry[existingIdx] = { ...commandRegistry[existingIdx], ...cmd };
    } else {
      commandRegistry.push(cmd);
    }
  }

  /**
   * Filters commands using fuzzy keyword and category matching
   * @param {string} query
   * @returns {Array} Filtered list of commands ordered by relevance
   */
  function filterCommands(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [...commandRegistry];

    return commandRegistry.filter(cmd => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.category && cmd.category.toLowerCase().includes(q)) return true;
      if (Array.isArray(cmd.keywords)) {
        return cmd.keywords.some(k => k.toLowerCase().includes(q));
      }
      return false;
    });
  }

  /**
   * Generates HTML markup for command list items
   * @param {Array} commands
   * @param {number} selectedIndex
   * @returns {string} HTML string
   */
  function renderCommandListHtml(commands, selectedIndex = 0) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return `
        <div class="p-6 text-center text-xs opacity-60">
          No matching commands found. Press Esc to close.
        </div>
      `;
    }

    return commands.map((cmd, idx) => {
      const isSelected = idx === selectedIndex ? 'is-selected' : '';
      return `
        <div class="cmd-palette-item ${isSelected}" data-index="${idx}" data-command-id="${cmd.id}">
          <div class="flex items-center space-x-3">
            <span class="text-xs px-2 py-0.5 rounded font-mono font-medium opacity-60" style="background: var(--paper);">
              ${cmd.category || 'General'}
            </span>
            <span class="font-medium text-sm">${cmd.title}</span>
          </div>
          ${cmd.shortcut ? `<span class="cmd-palette-kbd">${cmd.shortcut}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  return {
    DEFAULT_COMMANDS,
    resetRegistry,
    registerCommand,
    filterCommands,
    renderCommandListHtml
  };
}));
