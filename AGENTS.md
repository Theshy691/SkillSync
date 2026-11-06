# Repository Guidelines

## Project Structure

SkillSync is a vanilla JavaScript, HTML, CSS, and PHP application. The public pages are `index.html`, `app.html`, and `jobs.html`; the main browser controller is `script.js`, with job discovery in `assets/js/discovery.js`. Shared browser modules and styles live in `assets/js/modules/` and `assets/css/`. PHP endpoints are in `backend/`, with root-level endpoint files retained for compatibility. Database definitions are in `database/` and `schema.sql`; sample documents are in `examples/`. Jest tests are in `tests/`.

## Build, Test, and Run

- `npm test -- --runInBand` runs the Jest suite.
- `npm run build:css` compiles the local Tailwind utilities from `assets/css/utilities.input.css` into `assets/css/utilities.css`; commit both source and generated CSS when changing utilities.
- `docker compose up --build` starts the local application stack. Use `docker compose down` to stop it.
- `php tests/match_engine.php` runs the standalone PHP match-engine regression checks.

## Coding Style

Use two-space indentation in JavaScript, HTML, and CSS; follow the surrounding style in PHP. Keep browser modules focused and name them with lowercase snake case (for example, `url_cleaner.js`). Use descriptive camelCase for JavaScript functions and variables, and descriptive IDs for DOM hooks. Keep shared tokens and components in `assets/css/interface.css`; avoid adding duplicate page-level theme logic. Escape user-provided text before inserting it into HTML, validate inputs at the API boundary, and never commit credentials or real user data.

## Testing Guidelines

Add or update Jest tests under `tests/` using the existing `*.test.js` naming convention. Cover behavior and edge cases for changed flows. Run the relevant test file during development and the full suite before submitting. For PHP changes, run the relevant PHP checks as well. Rebuild CSS after changing utility classes.

## Commits and Pull Requests

Recent commits use short Conventional Commit prefixes such as `feat:`, `fix:`, `style:`, and `chore:`. Keep each commit focused on one coherent change and use an imperative summary, such as `fix(workspace): restore imported job description`. Pull requests should explain the user-visible change, note important implementation details, list tests and build commands run, link related issues when applicable, and include screenshots for visual changes. Call out required configuration or database updates.

## Configuration and Security

Use local configuration files or environment variables for Supabase and AI service credentials; never add secrets to source control. Preserve the existing authentication, ownership, input validation, rate-limit, and SSRF protections when changing backend endpoints.
