# SkillSync - Full-Stack AI Resume & Skill Matcher

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)]()
[![PHP](https://img.shields.io/badge/PHP-8.2-777BB4.svg?logo=php&logoColor=white)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)]()
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.0-38B2AC.svg?logo=tailwind-css&logoColor=white)]()
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E.svg?logo=supabase&logoColor=white)]()
[![Gemini](https://img.shields.io/badge/Gemini%20AI-Flash%201.5-8E75B2.svg?logo=google&logoColor=white)]()

SkillSync is an enterprise-grade, full-stack ATS (Applicant Tracking System) simulation and resume optimization platform. Powered by Google Gemini AI, Supabase (Authentication & PostgreSQL with Row Level Security), and a hardened PHP backend, SkillSync helps job seekers analyze their match compatibility against real-world job postings, identify critical skill gaps, and instantly access curated learning tutorials.

---

## Key Features

- **Resume comparison**: Paste or upload a resume, add a target job description, and compare them with one primary action. Reports show matched skills, requirements to review, and the scoring method.
- **Focused workspace**: Three views—Compare, Documents, and Applications—share the same navigation, colors, typography, light/dark theme, and responsive layout.
- **Saved documents and resumes**: Reuse uploaded documents and named resume versions. Secondary editing controls are inside Resume options. Replacing documents can be undone, and drafts restore within their owner's tab.
- **Job explorer**: Search roles, filter by discipline or remote availability, choose an external source, and transfer a job description into the workspace. External sources open their own search pages; URL import is available alongside them.
- **Application tracking**: Move roles through Saved, Applied, Interviewing, and Offer. Add an application manually or return to its resume comparison.
- **Follow-up tools**: Improve resume bullets, write a cover letter, practice interview questions, or build a study plan from the comparison report.
- **Report history and exports**: Open previous comparisons, copy a summary, or export a PDF. History stays collapsed until requested.
- **Explicit scoring states**: AI estimates, local demo comparisons, and keyword fallbacks are labeled. Unassessed roles and dimensions stay unassessed. Changed documents mark the previous report stale.
- **Authentication and backend safeguards**: Supabase accounts and row-level policies, per-user API rate limiting, server-side input validation, SSRF protection, and protected configuration files.

Decorative dashboards, duplicate job explorers, sound controls, simulated company dispatch, and unrelated salary/outreach panels are no longer part of the browser interface.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, Tailwind CSS (Dark/Light mode), Vanilla JavaScript (ES6+), PDF.js, html2pdf.js |
| **Backend** | PHP 8.2 (Apache, cURL, JSON, Mod_Rewrite, Mod_Headers) |
| **Database & Auth** | Supabase (PostgreSQL 15, Auth JWTs, Row Level Security) |
| **AI Intelligence** | Google Gemini API (`gemini-1.5-flash` with JSON Schema enforcement) |
| **Testing** | Jest, `jest-environment-jsdom` |
| **Containerization** | Docker, Docker Compose |

---

## Database Schema & Row Level Security (`schema.sql`)

Execute the contents of [`schema.sql`](schema.sql) in your Supabase SQL Editor.

### 1. `scan_history` Table
Stores past scan results linked to the authenticated user.

| Column | Data Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique record identifier |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | Owner user ID |
| `resume_snippet` | `TEXT` | `NOT NULL` | Preview snippet of candidate resume |
| `job_description` | `TEXT` | `NOT NULL` | Preview snippet of target job |
| `match_score` | `INTEGER` | `NOT NULL CHECK (match_score >= 0 AND match_score <= 100)` | ATS alignment percentage |
| `missing_skills` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Array of skill gaps |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Scan timestamp |

**RLS Policies for `scan_history`**:
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

### 2. `scraped_jobs_cache` Table
Shared cache for scraped and AI-cleaned job descriptions.

| Column | Data Type | Constraints & Defaults | Description |
|---|---|---|---|
| `url` | `TEXT` | `PRIMARY KEY` | Target posting URL |
| `cleaned_description` | `TEXT` | `NOT NULL` | Gemini-summarized job requirements |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Cache timestamp |

**RLS Policies for `scraped_jobs_cache`**:
- **SELECT**: `auth.role() = 'authenticated'`
- **INSERT**: `auth.role() = 'authenticated'`

### Database Indexes
```sql
CREATE INDEX idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX idx_scan_history_created_at ON scan_history(created_at DESC);
CREATE INDEX idx_scraped_jobs_cache_created_at ON scraped_jobs_cache(created_at DESC);
```

---

## Local Setup & Quickstart

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/)
- [Node.js 18+](https://nodejs.org/) (for running tests)
- A [Google AI Studio](https://aistudio.google.com/) Gemini API Key
- A free [Supabase](https://supabase.com/) project

### Step 1: Clone the Repository
```bash
git clone https://github.com/Theshy691/SkillSync.git
cd SkillSync
```

### Step 2: Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
Open `.env` and fill in your keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
```

Also update `config.js` for the frontend client:
```javascript
window.SKILLSYNC_CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your_supabase_anon_public_key_here"
};
```

### Step 3: Run Database Migrations
1. Open your Supabase Dashboard -> **SQL Editor**.
2. Open [`database/schema.sql`](database/schema.sql), paste the entire SQL script, and click **Run**.
   > **Note**: Supabase will display `Success. No rows returned`. In PostgreSQL, table and policy creation commands (DDL) return zero rows upon successful execution.
3. Verify table creation in Supabase -> **Table Editor** (`scan_history`, `scraped_jobs_cache`, `user_vault_documents`, `user_vault_profiles`, `resume_credibility_audits`).
4. (Optional) Run [`database/seed.sql`](database/seed.sql) to populate initial test scans.

### Build the workspace styles
The workspace uses a committed local utility stylesheet. After changing utility classes in HTML or JavaScript, regenerate it:
```bash
npm install
npm run build:css
```
The landing page uses `assets/css/interface.css` directly.

### Step 4: Start the Application with Docker Compose
Spin up the Apache PHP web server:
```bash
docker compose up -d --build
```
Access the application in your browser at:
```
http://localhost:8000
```

> **Live Reloading**: The local project directory is mounted directly into `/var/www/html`, allowing real-time edits without restarting containers.

---

## Technical Documentation Suite

Comprehensive architectural, schema, and API documentation is maintained in the [`docs/`](docs/) directory:
- [System Architecture & Flow Topology](docs/ARCHITECTURE.md)
- [REST API Reference](docs/API_REFERENCE.md)
- [PostgreSQL Database Schema & RLS Policies](docs/DATABASE_SCHEMA.md)
- [Project Directory Structure & Maintenance Runbook](docs/DIRECTORY_STRUCTURE.md)
- [Security, SSRF & Rate Limiting Audit](docs/SECURITY_AUDIT.md)
- [Docker & Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

---

## Running Automated Tests

SkillSync features a robust suite of **41 automated test suites** encompassing **299 tests** using **Jest** and **JSDOM** to ensure complete end-to-end reliability across all features:
- **UI & DOM**: Command palette, keyboard shortcuts (`Cmd+Enter`, `⌘K`), responsive docks, modal dialogues, toast engine, and theme persistence.
- **Algorithms**: Multi-dimensional ATS breakdown, timeline anachronism detection, buzzword stuffing audit, STAR interview scoring, and salary percentiles.
- **Integrations**: Standalone modules (taxonomy, URL sanitizer, outreach generator, roadmap generator), backend security contracts (SSRF, rate limiting, RLS), and Supabase client mocks.

```bash
# Install testing dependencies
npm install

# Run all 41 test suites (299 tests)
npm test

# Run tests with coverage report
npm run test:coverage
```

---

## API Reference

### 1. `POST /api.php`
Evaluates a resume against a target job description.
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <supabase_access_token>`
- **Request Body**:
  ```json
  {
    "resume": "Full-stack engineer with 4 years in React, Node, and Postgres...",
    "job_description": "Looking for a Senior Backend Engineer proficient in Go, Docker, Kubernetes..."
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "match_score": 78,
    "missing_skills": ["Go", "Kubernetes"]
  }
  ```

### 2. `POST /scrape.php`
Scrapes an external job posting URL and summarizes core requirements.
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <supabase_access_token>`
- **Request Body**:
  ```json
  {
    "url": "https://boards.greenhouse.io/company/jobs/12345"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "source": "ai_extracted",
    "url": "https://boards.greenhouse.io/company/jobs/12345",
    "cleaned_description": "**Job Title**: Senior Software Engineer\n**Responsibilities**: ..."
  }
  ```

---

## License

This project is licensed under the [MIT License](LICENSE).

### Comparison regression checks

Run frontend checks with `npm test -- --runInBand`. With the application container running, verify real PHP keyword fallback behavior with `docker exec skillsync_app php /var/www/html/tests/match_engine.php`. These checks do not call the external AI service.
