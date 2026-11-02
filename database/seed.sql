-- ==============================================================================
-- SkillSync - Sample Seed Data
-- File: database/seed.sql
-- ==============================================================================

-- Dynamically seeds scan records and vault documents for the most recently created auth user
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Automatically detect the first active user in auth.users
    SELECT id INTO target_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'No users found in auth.users. Please create an account in SkillSync or Supabase Auth before seeding.';
    ELSE
        -- 1. Seed Sample Scan History
        INSERT INTO scan_history (id, user_id, resume_snippet, job_description, match_score, missing_skills, created_at)
        VALUES
          (
            gen_random_uuid(),
            target_user_id,
            'Senior Full-Stack Engineer with 6+ years building microservices with React, TypeScript, and Node.js.',
            'Senior Full-Stack Engineer role requiring React, Node.js, TypeScript, PostgreSQL, and GraphQL.',
            94,
            '["GraphQL", "Redis"]'::jsonb,
            NOW() - INTERVAL '1 day'
          ),
          (
            gen_random_uuid(),
            target_user_id,
            'Frontend Developer experienced in React, HTML5, CSS3, Tailwind CSS, and Figma designs.',
            'Full-Stack Developer requiring Python, Django, PostgreSQL, Docker, and Kubernetes.',
            62,
            '["Python", "Django", "Docker", "Kubernetes"]'::jsonb,
            NOW() - INTERVAL '3 days'
          );

        -- 2. Seed Sample Vault Documents
        INSERT INTO user_vault_documents (id, user_id, doc_type, doc_name, content_snippet, extracted_skills, created_at)
        VALUES
          (
            gen_random_uuid(),
            target_user_id,
            'resume',
            'Master_Resume_2026.pdf',
            'Full-Stack Developer with expertise in React, TypeScript, Node.js, and PostgreSQL.',
            '["React", "TypeScript", "Node.js", "PostgreSQL", "Git"]'::jsonb,
            NOW() - INTERVAL '5 days'
          ),
          (
            gen_random_uuid(),
            target_user_id,
            'certification',
            'AWS_Solutions_Architect_Associate.pdf',
            'AWS Certified Solutions Architect – Associate (SAA-C03). Issued Nov 2025.',
            '["AWS", "Cloud Architecture", "Docker", "S3", "Lambda"]'::jsonb,
            NOW() - INTERVAL '2 days'
          );

        RAISE NOTICE 'Successfully seeded sample data for user: %', target_user_id;
    END IF;
END $$;
