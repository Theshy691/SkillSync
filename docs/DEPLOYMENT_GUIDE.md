# SkillSync Deployment & Containerization Guide

## Production Deployment with Docker

### Prerequisites
- Docker & Docker Compose
- Supabase Project URL and Public Anon Key
- Google Gemini API Key

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
GEMINI_API_KEY=AIzaSy...
```

### 2. Run Database Migrations in Supabase
1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** in the left sidebar.
3. Paste the contents of [`database/schema.sql`](../database/schema.sql) and click **Run**.
4. When Supabase displays `Success. No rows returned`, the PostgreSQL DDL execution completed cleanly.
5. In **Table Editor**, confirm all 5 core tables exist:
   - `scan_history`
   - `scraped_jobs_cache`
   - `user_vault_documents`
   - `user_vault_profiles`
   - `resume_credibility_audits`

### 3. Start Services via Docker Compose
Build and run the container in detached mode:
```bash
docker compose up -d --build
```

### 4. Verify Container Health
```bash
docker compose ps
curl -sI http://localhost:8000/
```

### 5. Direct Apache/PHP Deployment
If deploying to a traditional LAMP/LEMP server:
1. Ensure `mod_rewrite` and `mod_headers` are enabled in Apache.
2. Confirm `.htaccess` is recognized (`AllowOverride All`).
3. Set write permissions on temporary limit storage:
   ```bash
   mkdir -p /tmp/skillsync_limits && chmod 777 /tmp/skillsync_limits
   ```
