# Supabase PostgreSQL Database Schema

SkillSync utilizes two main tables hosted on Supabase with Row Level Security (RLS) enabled.

## 1. `scan_history`
Stores evaluated resumes, match scores, and missing skill gaps under authenticated user accounts.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique record identifier |
| `user_id` | `UUID` | `NOT NULL, REFERENCES auth.users(id)` | Supabase authenticated user ID |
| `resume_snippet` | `TEXT` | `NOT NULL` | Truncated snippet of candidate resume |
| `job_description` | `TEXT` | `NOT NULL` | Target job responsibilities snippet |
| `match_score` | `INTEGER` | `NOT NULL, CHECK (match_score >= 0 AND match_score <= 100)` | ATS score (0-100) |
| `missing_skills` | `JSONB` | `NOT NULL, DEFAULT '[]'::jsonb` | Array of missing skill string tags |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Timestamp of evaluation |

### RLS Policies
- `Users can view their own scans`: `SELECT USING (auth.uid() = user_id)`
- `Users can insert their own scans`: `INSERT WITH CHECK (auth.uid() = user_id)`
- `Users can delete their own scans`: `DELETE USING (auth.uid() = user_id)`

---

## 2. `scraped_jobs_cache`
Caches parsed and sanitized external job postings to eliminate duplicate scraping calls.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Cache entry identifier |
| `url_hash` | `VARCHAR(64)` | `UNIQUE, NOT NULL` | SHA-256 hash of job posting URL |
| `original_url` | `TEXT` | `NOT NULL` | Full external job URL |
| `cleaned_text` | `TEXT` | `NOT NULL` | AI-extracted job requirements |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Timestamp of initial scrape |
