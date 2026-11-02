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

- **Candidate Skill Vault & Verified Taxonomy Matrix**: Centralized repository for candidate certificates, licenses, and transcripts. Synthesizes a verified technical skill matrix (Languages, Frameworks, Cloud & DevOps, Certifications) and syncs directly with the ATS scanner.
- **Resume Credibility & Anti-Hallucination Audit Engine (`tests/authenticity.test.js`)**: Evaluates resumes for chronological anachronisms (e.g. claiming 10+ years in Docker before its release), unevidenced buzzword stuffing, statistically implausible metric spikes (+9000%), and title inflation.
- **Quiet-Chrome Developer UI (Linear / Raycast Aesthetic)**: Precision-engineered interface utilizing flat surfaces, hairline borders (`var(--ws-border)`), DM Mono metadata typography, and high contrast compliant with WCAG AA standards. Audited and verified using the Impeccable UI suite.
- **Free Public Job Discovery & Explorer (`jobs.html`)**: Freely search, browse, and filter active engineering roles across AI, Cloud/DevOps, Full-Stack, and Frontend without requiring authentication. Includes multi-facet category filtering, remote-only toggle, interactive job preview modals, and a 1-click ATS workspace bridge that transfers job details directly into the scanner.
- **Interactive Mock Interview Simulator & STAR Answer Coach**: Practice technical questions with real-time feedback, STAR model answer comparisons, and trilingual support (English, Tagalog, and Taglish tech code-switching).
- **Global Command Palette (`⌘K`)**: Instant workspace spotlight search with keyboard navigation (`↑`, `↓`, `Enter`, `Esc`), shortcut routing, and live filter queries.
- **2-Week Skill Bridge Learning Roadmap**: Automatically converts detected missing skill gaps into an interactive 14-day study plan with progress tracking and YouTube deep-dive tutorials.
- **Salary Benchmarking & AI Counter-Offer Coach**: Calculates 25th, 50th, 75th, and 90th percentile compensation benchmarks adjusted for seniority tiers and cost of living, providing automated counter-offer negotiation scripts.
- **Gemini AI Resume Matcher Proxy (`api.php`)**: Evaluates resumes against job descriptions with ATS accuracy, returning an objective 0–100 match score and prioritized skill gap recommendations in strict JSON.
- **AI-Powered Web Scraper with Cache (`scrape.php`)**: Fetches external job postings from URLs (LinkedIn, Indeed, Greenhouse, etc.), extracts core requirements via Gemini AI, and caches results in Supabase to eliminate redundant AI calls.
- **Client-Side PDF Parsing (`pdf.js`)**: Fast, in-browser PDF resume extraction without transmitting unparsed binary documents.
- **Single-Click PDF Export (`html2pdf.js`)**: Exports formatted analysis reports directly to downloadable A4 PDF documents.
- **Clipboard Summary Copy**: Formats and copies key match highlights and recommendations directly to the clipboard.
- **Interactive History Dashboard**: Real-time Supabase history with dynamic sorting (Newest, Oldest, Highest Score, Lowest Score), single-record deletion, and "Clear All History" controls.
- **Hardened Security Architecture**:
  - Supabase Row Level Security (RLS) policies enforcing multi-tenant isolation across all tables.
  - Per-user backend sliding-window rate limiting (max 5 requests/minute).
  - Server-Side Request Forgery (SSRF) protection blocking internal/metadata IP ranges.
  - Production error suppression with logging to a protected `secure_php_errors.log`.
  - Apache `.htaccess` rules denying direct HTTP access to `.env`, `.log`, `.sql`, and configuration files.
  - High-capacity input processing supporting comprehensive resumes and enterprise job postings (up to 100,000 characters).

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
