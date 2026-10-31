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

### 2. Start Services via Docker Compose
Build and run the container in detached mode:
```bash
docker compose up -d --build
```

### 3. Verify Container Health
```bash
docker compose ps
curl -sI http://localhost:8000/
```

### 4. Direct Apache/PHP Deployment
If deploying to a traditional LAMP/LEMP server:
1. Ensure `mod_rewrite` and `mod_headers` are enabled in Apache.
2. Confirm `.htaccess` is recognized (`AllowOverride All`).
3. Set write permissions on temporary limit storage:
   ```bash
   mkdir -p /tmp/skillsync_limits && chmod 777 /tmp/skillsync_limits
   ```
