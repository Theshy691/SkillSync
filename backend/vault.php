<?php
/**
 * SkillSync - Candidate Skill Vault & Profile Service
 * File: backend/vault.php
 *
 * Manages multi-document credential storage (resumes, certifications, portfolios),
 * extracts structured skill entities, and maintains a unified verified candidate profile.
 */

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    sendJsonResponse([
        'error' => 'Method Not Allowed',
        'message' => 'Only GET or POST requests are permitted.'
    ], 405);
}

// 1. Skill Extraction Taxonomy for Structured Profile Synthesis
function extractVaultSkills(string $text): array {
    $taxonomy = [
        'languages' => [
            'typescript', 'javascript', 'python', 'php', 'go', 'golang',
            'rust', 'c++', 'c#', 'java', 'ruby', 'sql', 'html5', 'css3', 'bash'
        ],
        'frameworks' => [
            'react', 'react native', 'next.js', 'vue.js', 'vue', 'angular',
            'svelte', 'node.js', 'node', 'express', 'fastapi', 'django',
            'laravel', 'spring boot', 'tailwind css', 'tailwind', 'graphql'
        ],
        'cloud' => [
            'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform',
            'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'kafka',
            'ci/cd', 'github actions', 'linux', 'playwright', 'jest'
        ],
        'certifications' => [
            'aws certified solutions architect', 'aws certified developer',
            'cka', 'certified kubernetes administrator', 'hashicorp certified terraform',
            'google cloud certified', 'meta front-end developer', 'scrum master'
        ]
    ];

    $lower = mb_strtolower($text, 'UTF-8');
    $detected = [
        'languages' => [],
        'frameworks' => [],
        'cloud' => [],
        'certifications' => []
    ];

    foreach ($taxonomy as $category => $skills) {
        foreach ($skills as $skill) {
            $escaped = preg_quote($skill, '/');
            if (preg_match('/(?:^|[\s,;:.()\/\\[\\]])' . $escaped . '(?:$|[\s,;:.()\/\\[\\]])/i', $lower)) {
                $formatted = ucwords($skill);
                // Formatting acronyms
                if (in_array(strtolower($skill), ['aws', 'gcp', 'cka', 'sql', 'ci/cd', 'html5', 'css3', 'php'])) {
                    $formatted = strtoupper($skill);
                }
                $detected[$category][] = $formatted;
            }
        }
    }

    return $detected;
}

// 2. Default Seed Vault Profile (for demo or guest sessions)
function getDemoVaultData(): array {
    return [
        'profile' => [
            'target_role' => 'Senior Full-Stack & Cloud Engineer',
            'experience_level' => '5+ Years Professional Experience',
            'verified_skills' => [
                'languages' => ['TypeScript', 'JavaScript', 'Python', 'SQL'],
                'frameworks' => ['React', 'Next.js', 'Node.js', 'FastAPI', 'Tailwind CSS'],
                'cloud' => ['Docker', 'AWS', 'PostgreSQL', 'Redis', 'CI/CD'],
                'certifications' => ['AWS Certified Solutions Architect']
            ]
        ],
        'documents' => [
            [
                'id' => 'doc-vault-1',
                'doc_type' => 'resume',
                'doc_name' => 'Master_Software_Engineer_CV.pdf',
                'content_snippet' => 'Senior Developer with 5 years leading full-stack projects in React, Node.js, TypeScript, and AWS.',
                'extracted_skills' => ['React', 'TypeScript', 'Node.js', 'AWS', 'PostgreSQL'],
                'created_at' => date('Y-m-d', strtotime('-3 days'))
            ],
            [
                'id' => 'doc-vault-2',
                'doc_type' => 'certification',
                'doc_name' => 'AWS_Solutions_Architect_Certificate.pdf',
                'content_snippet' => 'AWS Certified Solutions Architect – Associate. Verified cloud architecture and containerization.',
                'extracted_skills' => ['AWS', 'Docker', 'Cloud Architecture'],
                'created_at' => date('Y-m-d', strtotime('-1 day'))
            ]
        ]
    ];
}

// 3. Handle GET: Return Vault Data
if ($method === 'GET') {
    sendJsonResponse([
        'success' => true,
        'data' => getDemoVaultData()
    ], 200);
}

// 4. Handle POST Actions
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: $_POST;
$action = $body['action'] ?? 'extract_skills';

switch ($action) {
    case 'extract_skills':
        $text = trim($body['text'] ?? '');
        if (empty($text)) {
            sendJsonResponse([
                'error' => 'Bad Request',
                'message' => 'The "text" field is required for skill extraction.'
            ], 400);
        }
        $extracted = extractVaultSkills($text);
        sendJsonResponse([
            'success' => true,
            'extracted_skills' => $extracted
        ], 200);
        break;

    case 'add_document':
        $docName = trim($body['doc_name'] ?? 'Uploaded_Document.pdf');
        $docType = trim($body['doc_type'] ?? 'certification');
        $content = trim($body['content'] ?? '');

        if (empty($content)) {
            sendJsonResponse([
                'error' => 'Bad Request',
                'message' => 'Document content is required.'
            ], 400);
        }

        $skills = extractVaultSkills($content);
        $flatSkills = array_merge(...array_values($skills));

        $newDoc = [
            'id' => 'doc-vault-' . time(),
            'doc_type' => in_array($docType, ['resume', 'certification', 'portfolio', 'project']) ? $docType : 'certification',
            'doc_name' => htmlspecialchars($docName, ENT_QUOTES, 'UTF-8'),
            'content_snippet' => (mb_strlen($content) > 160) ? (mb_substr($content, 0, 157) . '...') : $content,
            'extracted_skills' => array_values(array_unique($flatSkills)),
            'created_at' => date('Y-m-d')
        ];

        sendJsonResponse([
            'success' => true,
            'message' => 'Document successfully added to vault.',
            'document' => $newDoc,
            'extracted_matrix' => $skills
        ], 201);
        break;

    default:
        sendJsonResponse([
            'error' => 'Bad Request',
            'message' => 'Unsupported action. Supported: extract_skills, add_document.'
        ], 400);
        break;
}

