<?php
/**
 * SkillSync - AI Resume Matcher Proxy API
 * File: api.php
 *
 * Verifies Supabase authentication, enforces per-user rate limits,
 * validates character bounds (<= 5,000 characters), sends structured prompt
 * to Gemini AI, and returns match_score and missing_skills JSON.
 */

require_once __DIR__ . '/bootstrap.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'error' => 'Method Not Allowed',
        'message' => 'Only POST requests are permitted.'
    ], 405);
}

// 1. Verify Authorization Header
$token = getBearerToken();
if (empty($token)) {
    sendJsonResponse([
        'error' => 'Unauthorized',
        'message' => 'Missing or invalid Bearer token in Authorization header.'
    ], 401);
}

$user = verifySupabaseToken($token);
if (!$user || empty($user['id'])) {
    sendJsonResponse([
        'error' => 'Unauthorized',
        'message' => 'Invalid or expired user session.'
    ], 401);
}

// 2. Enforce Rate Limiting (5 requests per minute per user)
enforceRateLimit($user['id'], 5, 60);

// 3. Parse and Validate Request Payload
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$resume = '';
$jobDescription = '';

if (is_array($body)) {
    $resume = trim($body['resume'] ?? ($body['resume_text'] ?? ''));
    $jobDescription = trim($body['job_description'] ?? ($body['jobDescription'] ?? ''));
} else {
    $resume = trim($_POST['resume'] ?? ($_POST['resume_text'] ?? ''));
    $jobDescription = trim($_POST['job_description'] ?? ($_POST['jobDescription'] ?? ''));
}

if (empty($resume) || empty($jobDescription)) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'Both "resume" and "job_description" are required fields.'
    ], 400);
}

// Strict Character Limit Verification (5,000 characters maximum)
$resumeLength = mb_strlen($resume);
$jobLength = mb_strlen($jobDescription);

if ($resumeLength > 5000 || $jobLength > 5000) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => "Character limit exceeded. Resume ({$resumeLength} chars) and job description ({$jobLength} chars) must each be 5,000 characters or fewer."
    ], 400);
}

// 4. Gemini AI Request
$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    error_log("[API] Missing GEMINI_API_KEY. Falling back to resilient heuristic engine.");
    sendJsonResponse(calculateHeuristicMatch($resume, $jobDescription), 200);
}

$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={$geminiApiKey}";

$prompt = <<<EOT
You are an expert ATS (Applicant Tracking System) and senior hiring manager evaluator.
Compare the provided candidate resume against the target job description.

1. Calculate an accurate, objective match score from 0 to 100 based on required skills, domain knowledge, years of experience, and qualifications.
2. Identify all missing skills, missing tools, unmentioned qualifications, or key growth areas the candidate lacks for this role.
3. Keep missing skills concise (1 to 3 words each, e.g. "Docker", "GraphQL", "Kubernetes", "TypeScript").

Output strictly valid JSON matching this schema:
{
  "match_score": 85,
  "missing_skills": ["Skill 1", "Skill 2"]
}

Candidate Resume:
---
{$resume}
---

Target Job Description:
---
{$jobDescription}
---
EOT;

$geminiPayload = [
    'contents' => [
        [
            'parts' => [
                ['text' => $prompt]
            ]
        ]
    ],
    'generationConfig' => [
        'responseMimeType' => 'application/json',
        'temperature' => 0.2
    ]
];

$geminiCurl = curl_init($geminiUrl);
curl_setopt_array($geminiCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($geminiPayload),
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true
]);

/**
 * Heuristic ATS Matching Engine (High-reliability fallback when external AI quota is exhausted)
 */
function calculateHeuristicMatch(string $resume, string $jobDescription): array {
    $taxonomy = [
        'typescript', 'javascript', 'python', 'php', 'go', 'golang', 'rust', 'c++', 'c#', 'java', 'ruby', 'sql',
        'html5', 'css3', 'bash', 'react', 'react native', 'next.js', 'vue', 'angular', 'svelte', 'node.js', 'node',
        'express', 'fastapi', 'django', 'laravel', 'tailwind css', 'tailwind', 'graphql', 'docker', 'kubernetes',
        'aws', 'gcp', 'azure', 'terraform', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'ci/cd',
        'github actions', 'linux', 'playwright', 'jest', 'rest api', 'microservices', 'git'
    ];

    $resumeLower = mb_strtolower($resume, 'UTF-8');
    $jobLower = mb_strtolower($jobDescription, 'UTF-8');

    $candidateSkills = [];
    $jobSkills = [];

    foreach ($taxonomy as $skill) {
        $escaped = preg_quote($skill, '/');
        $pattern = '/(?:^|[\s,;:.()\/\\[\\]])' . $escaped . '(?:$|[\s,;:.()\/\\[\\]])/i';

        if (preg_match($pattern, $resumeLower)) {
            $candidateSkills[] = $skill;
        }
        if (preg_match($pattern, $jobLower)) {
            $jobSkills[] = $skill;
        }
    }

    $candidateSkills = array_unique($candidateSkills);
    $jobSkills = array_unique($jobSkills);

    if (empty($jobSkills)) {
        $jobSkills = ['software engineering', 'problem solving', 'system design'];
    }

    $matching = [];
    $missing = [];

    foreach ($jobSkills as $req) {
        $hasMatch = false;
        foreach ($candidateSkills as $c) {
            if ($c === $req || str_contains($c, $req) || str_contains($req, $c)) {
                $hasMatch = true;
                break;
            }
        }
        if ($hasMatch) {
            $matching[] = $req;
        } else {
            $missing[] = $req;
        }
    }

    $total = count($matching) + count($missing);
    $ratio = $total > 0 ? count($matching) / $total : 0.6;
    $rawScore = (int)round(38 + ($ratio * 58));
    $score = max(35, min(98, $rawScore));

    $ucFirstSkill = function ($s) {
        if (in_array(strtolower($s), ['aws', 'gcp', 'cka', 'sql', 'ci/cd', 'html5', 'css3', 'php'])) {
            return strtoupper($s);
        }
        return ucwords($s);
    };

    return [
        'match_score' => $score,
        'missing_skills' => array_values(array_map($ucFirstSkill, array_slice($missing, 0, 5))),
        'source' => 'resilient_engine'
    ];
}

$geminiResponse = curl_exec($geminiCurl);
$geminiHttpCode = curl_getinfo($geminiCurl, CURLINFO_HTTP_CODE);
$geminiErr = curl_error($geminiCurl);
curl_close($geminiCurl);

if ($geminiErr || $geminiHttpCode !== 200 || empty($geminiResponse)) {
    error_log("[API] Gemini API error: HTTP {$geminiHttpCode} - {$geminiErr}. Falling back to resilient heuristic engine.");
    sendJsonResponse(calculateHeuristicMatch($resume, $jobDescription), 200);
}

$geminiJson = json_decode($geminiResponse, true);
$rawAiText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';

if (empty($rawAiText)) {
    sendJsonResponse(calculateHeuristicMatch($resume, $jobDescription), 200);
}

// Clean and decode JSON
$parsedAi = json_decode(trim($rawAiText), true);

if (!is_array($parsedAi)) {
    // Attempt fallback JSON extraction if fences or extra characters exist
    if (preg_match('/\{[\s\S]*\}/', $rawAiText, $jsonMatches)) {
        $parsedAi = json_decode($jsonMatches[0], true);
    }
}

if (!is_array($parsedAi) || !isset($parsedAi['match_score'])) {
    error_log("[API] Unexpected response format from AI: {$rawAiText}. Falling back to resilient heuristic engine.");
    sendJsonResponse(calculateHeuristicMatch($resume, $jobDescription), 200);
}

// Normalize and validate score and missing skills
$matchScore = intval($parsedAi['match_score']);
$matchScore = max(0, min(100, $matchScore)); // Clamp between 0 and 100

$missingSkills = [];
if (!empty($parsedAi['missing_skills']) && is_array($parsedAi['missing_skills'])) {
    foreach ($parsedAi['missing_skills'] as $skill) {
        if (is_string($skill)) {
            $cleanedSkill = trim($skill);
            if ($cleanedSkill !== '') {
                $missingSkills[] = $cleanedSkill;
            }
        }
    }
}

// Return validated response
sendJsonResponse([
    'match_score' => $matchScore,
    'missing_skills' => array_values(array_unique($missingSkills))
], 200);
