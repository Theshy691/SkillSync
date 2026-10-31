-- ==============================================================================
-- SkillSync - Sample Seed Data
-- File: database/seed.sql
-- ==============================================================================

-- Sample scan records for local database seeding and testing
-- Replace '00000000-0000-0000-0000-000000000000' with a valid auth.users UUID if testing with live Supabase.

INSERT INTO scan_history (id, user_id, resume_snippet, job_description, match_score, missing_skills, created_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'Senior Full-Stack Engineer with 6+ years building microservices with React, TypeScript, and Node.js.',
    'Senior Full-Stack Engineer role requiring React, Node.js, TypeScript, PostgreSQL, and GraphQL.',
    94,
    '["GraphQL", "Redis"]'::jsonb,
    NOW() - INTERVAL '1 day'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'Frontend Developer experienced in React, HTML5, CSS3, Tailwind CSS, and Figma designs.',
    'Full-Stack Developer requiring Python, Django, PostgreSQL, Docker, and Kubernetes.',
    62,
    '["Python", "Django", "Docker", "Kubernetes"]'::jsonb,
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO NOTHING;
