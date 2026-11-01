-- ==============================================================================
-- SkillSync - Supabase Database Schema & Row Level Security (RLS)
-- File: schema.sql
-- ==============================================================================

-- 1. Scan History Table
-- Stores analysis results performed by authenticated users
CREATE TABLE IF NOT EXISTS scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_snippet TEXT NOT NULL,
    job_description TEXT NOT NULL,
    match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Scraped Jobs Cache Table
-- Shared cache across users for scraped and cleaned job descriptions
CREATE TABLE IF NOT EXISTS scraped_jobs_cache (
    url TEXT PRIMARY KEY,
    cleaned_description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Skill Vault Documents Table
-- Stores user-uploaded credentials, master resumes, and certifications
CREATE TABLE IF NOT EXISTS user_vault_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('resume', 'certification', 'portfolio', 'project')),
    doc_name TEXT NOT NULL,
    content_snippet TEXT NOT NULL,
    extracted_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. User Skill Vault Profiles
-- Synthesized candidate skill matrix across all vault documents
CREATE TABLE IF NOT EXISTS user_vault_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    target_role TEXT DEFAULT 'Full-Stack Software Engineer',
    verified_skills JSONB NOT NULL DEFAULT '{"languages":[], "frameworks":[], "cloud":[], "certifications":[]}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Database Indexes for High-Performance Queries
-- Index on user_id for rapid user history lookups
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);

-- Index on created_at for chronological sorting
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);

-- Index on cache table created_at for optional TTL maintenance
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_cache_created_at ON scraped_jobs_cache(created_at DESC);

-- Index on vault documents user_id
CREATE INDEX IF NOT EXISTS idx_user_vault_documents_user_id ON user_vault_documents(user_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_jobs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vault_profiles ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies for scan_history
-- Policy: Users can only view their own scan records
CREATE POLICY "Users can view own scan history"
    ON scan_history
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own scan records
CREATE POLICY "Users can insert own scan history"
    ON scan_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own scan records
CREATE POLICY "Users can delete own scan history"
    ON scan_history
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 6. Row Level Security Policies for scraped_jobs_cache
-- Policy: All authenticated users can read from the shared cache
CREATE POLICY "Authenticated users can read scraped jobs cache"
    ON scraped_jobs_cache
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

-- Policy: All authenticated users can write new entries into the shared cache
CREATE POLICY "Authenticated users can insert into scraped jobs cache"
    ON scraped_jobs_cache
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

-- 7. Row Level Security Policies for user_vault_documents
CREATE POLICY "Users can manage own vault documents"
    ON user_vault_documents
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 8. Row Level Security Policies for user_vault_profiles
CREATE POLICY "Users can manage own vault profile"
    ON user_vault_profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
