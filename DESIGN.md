---
name: SkillSync
description: AI-powered ATS resume intelligence and career acceleration suite
colors:
  sage: "#7cb585"
  sage-light: "rgba(124, 181, 133, 0.12)"
  amber: "#dfa055"
  amber-light: "rgba(223, 160, 85, 0.12)"
  rose: "#da7d8f"
  rose-light: "rgba(218, 125, 143, 0.12)"
  sky: "#7fb3d9"
  sky-light: "rgba(127, 179, 217, 0.12)"
  paper: "#0b0c10"
  paper-2: "#11141a"
  paper-3: "#1a1f27"
  ink: "#f8fafc"
  ink-2: "#e2e8f0"
  ink-3: "#cbd5e1"
  ink-4: "#94a3b8"
  border: "rgba(255, 239, 222, 0.08)"
  border-2: "rgba(255, 239, 222, 0.18)"
  white: "#ffffff"
  dark-ink: "#07090d"
  muted: "#d1c6bb"
typography:
  display:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "DM Mono, JetBrains Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
rounded:
  xs: "4px"
  sm: "8px"
  md: "14px"
  card: "18px"
  lg: "20px"
  xl: "24px"
  "2xl": "26px"
  surface: "28px"
  panel: "30px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.sage}"
    textColor: "#0b0c10"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "#93cca1"
  button-secondary:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-3}"
---

## Overview

SkillSync's visual design language is grounded in **Quiet Chrome**: an editorial, high-contrast, tactile workspace aesthetic inspired by Linear, Raycast, and modern craft software. It replaces harsh generic blues and purple AI gradients with rich warm tones, sage accents, subtle atmospheric blur, and physics-driven spring micro-interactions.

## Colors

The palette balances deep dark paper surfaces (`#0b0c10`, `#11141a`) with warm cream inks (`#f7f0e8`, `#ddd2c7`) and nature-inspired semantic indicators:
- **Sage (`#7cb585`)**: Primary brand accent, strong match indicator (85%+ fit), positive actions.
- **Amber (`#dfa055`)**: Cautionary status, moderate ATS match fit, pending actions.
- **Rose (`#da7d8f`)**: High-risk credibility alerts, rejection stage, destructive confirmation.
- **Sky (`#7fb3d9`)**: Informational tips, learning roadmap milestones, neutral tags.

## Typography

- **Headings & Primary UI**: `DM Sans` with tight negative letter-spacing (`-0.02em`) on bold displays to project authority.
- **Monospace Elements**: `JetBrains Mono` or system monospace for keybindings (`⌘K`), percentage metrics, timecodes, and code snippets.
- **Legibility Floor**: Functional and interactive text must not fall below `11px`. Only secondary non-interactive smallprint may use `10px`.

## Layout

- **Responsive Grid**: Flex and CSS Grid layouts with adaptive columns (single-column on mobile, split-pane ATS analyzer on desktop).
- **Proportional Spacing**: Spacing intervals based on an 8px grid (`8px`, `16px`, `24px`, `32px`).
- **Surface Elevation**: Avoid nested cards inside cards. Differentiate hierarchical sections using border dividers (`--border`), subtle background shifts (`--paper-2` to `--paper-3`), and whitespace rather than stacking boxes.

## Elevation & Depth

- **Shadows**: Smooth multi-layer ambient drop shadows:
  - `sm`: `0 12px 30px rgba(0, 0, 0, 0.28)`
  - `md`: `0 18px 46px rgba(0, 0, 0, 0.36)`
  - `lg`: `0 32px 70px rgba(0, 0, 0, 0.5)`
- **Glassmorphism**: Backdrop blur (`backdrop-filter: blur(16px)`) on modals and floating HUD elements with semi-transparent surfaces.

## Shapes

- **Inputs & Buttons**: `14px` border-radius (`--radius`) for tactile touch targets and inputs.
- **Modals & Cards**: `20px` to `26px` border-radius (`--radius-lg`) for large structural panels.
- **Pills & Badges**: `9999px` capsule radius for status chips and tags.

## Components

- **Tactile Buttons**: Subtle spring press effect (`transform: scale(0.975)`) on click with smooth spring return (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Command Palette (`⌘K`)**: Quick fuzzy spotlight search modal with keyboard navigation (`↑`, `↓`, `Enter`, `Esc`).
- **Rolling Score Odometer**: Decelerated counter animation (`easeOutCubic`) paired with dynamic radial SVG SVG gauge rings.
- **Resume Credibility Radar**: 5-axis SVG spider chart and fact-check inspector with clear severity chips.

## Do's and Don'ts

### Do:
- Use WCAG AA compliant contrast ratios (at least 4.5:1 for standard text, 3:1 for large text).
- Use active spring easing (`cubic-bezier(0.16, 1, 0.3, 1)`) for UI transitions.
- Maintain subtle haptics and celebratory milestones (confetti and audio chime on Offer status).
- Keep text labels clear, concise, and actionable.

### Don't:
- Never use generic purple-to-blue AI gradients or cliché card-in-card nesting.
- Never use undersized functional text below 11px.
- Never leave buttons without explicit active/hover states.
- Never block user workflow with unclosable modal backdrops.

