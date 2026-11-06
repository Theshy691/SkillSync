---
name: SkillSync
description: A focused resume comparison workspace for job seekers
---

# SkillSync interface

The interface centers on the candidate’s documents: resume, target role, comparison, and next steps. Keep the sage brand accent, clear typography, and quiet surfaces consistent between marketing and the workspace.

## Color

`assets/css/interface.css` owns the current shared palette. Light mode uses cool paper `#f5f7f6`, white surfaces `#ffffff`, primary ink `#172a25`, secondary ink `#52645b`, forest `#255e48`, and borders `#dce5df`. Dark mode uses paper `#111b18`, surfaces `#17241e`, ink `#eff5f1`, secondary ink `#b0c3b7`, sage `#9bc9ad`, and borders `#30443a`.

Use amber for requirements to review, rose for errors, and sage for supported matches and primary actions. Combine color with readable text. Avoid decorative background washes and automatic score cycling.

## Type and layout

Use DM Sans for headings and interface text. Reserve DM Mono for filenames, keyboard shortcuts, and short data labels. Headings use a restrained weight and scale; functional form text uses 14px on desktop and 16px on touch-sized layouts. Body content should stay under 80 characters per line.

All pages share one header, wordmark, theme control, active navigation state, and mobile menu. Marketing has a short value proposition, an immediate comparison action, and a clearly labeled illustrative report. On small screens, navigation becomes an accessible menu. All essential content is visible without entrance animations or JavaScript.

The workspace places the resume and target role side by side on desktop and stacks them on mobile. Use a single primary comparison action, field-specific errors, preserved drafts, and an undo action for replacements. Additional tools stay below the core report.

The workspace has three views: Compare, Documents, and Applications. Job discovery lives on its own page. Keep resume versions under Resume options, URL import under the target role, previous comparisons in a collapsed history section, and score explanations in report disclosures. Display the sample action only in Compare. Documents lists files directly; Applications shows the four status columns without a separate analytics dashboard.

Remove duplicate entry points and controls for absent panels. Keep interview labels understandable to a job seeker: For this role, Question library, and Add a question. Do not expose internal model or dataset terminology in navigation.

## Scores and states

- Distinguish AI estimates, local demo comparisons, and keyword fallbacks.
- Keyword coverage is the percentage of recognized role technologies also present in the resume. Deduplicate aliases. Never fabricate baseline points, missing skills, or experience dimensions.
- Unknown keyword roles are unassessed, not perfect matches or zero-quality candidates.
- A report for changed documents must be marked stale before its suggestions are used.
- Loading states explain the current task. Failures preserve documents and give a retry path.
- Sample data must remain explicitly labeled. Avoid unsupported guarantees about hiring outcomes, accuracy, privacy, or speed.

## Accessibility

Provide visible focus, labeled form controls, keyboard-operable buttons, a skip link, and reduced-motion support. Keep interactive content in the accessibility tree. Mobile controls should have at least 44px targets and must not disable zoom. Validate light and dark themes and prevent horizontal document overflow.

## Stylesheets

`interface.css` is the single palette and shared component source for the homepage, workspace, and job explorer. Cards use 12px corners; buttons and fields use 6px. Header heights are 72px on desktop and 68px on mobile, plus the divider. `workspace.css` and `motion.css` provide application-specific layouts. No application page loads the old `landing-page.css`. Do not add blanket geometry overrides with `!important`.

`assets/js/modules/interface.js` owns theme persistence, theme labels, mobile menus, and dialog focus handling. Page controllers delegate to it instead of binding separate theme listeners. HTML must revalidate; version changed CSS and JavaScript together to prevent mixed releases.

Workspace utilities are compiled locally from `utilities.input.css`, `tailwind.config.js`, and the application source. After editing utility classes, run `npm run build:css` and commit the generated `utilities.css`. The workspace does not need the Tailwind runtime CDN.
