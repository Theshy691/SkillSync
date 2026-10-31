/**
 * SkillSync - Client Configuration
 *
 * DEMO_MODE: When true, enables a zero-configuration local mock system
 * allowing instant testing of all features (Auth, AI Matching, History Dashboard,
 * PDF parsing, Scraper, and PDF Export) without requiring cloud Supabase credentials.
 * Set DEMO_MODE: false when you plug in your actual cloud Supabase project credentials.
 */
window.SKILLSYNC_CONFIG = {
  DEMO_MODE: true,
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your_supabase_anon_public_key_here"
};
