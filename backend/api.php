<?php
/**
 * SkillSync - AI Resume Matcher Proxy API
 * File: api.php
 *
 * Verifies Supabase authentication, enforces per-user rate limits,
 * validates payload safety thresholds (<= 100,000 characters), sends structured prompt
 * to Gemini AI, and returns match_score and missing_skills JSON.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/match_engine.php';

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

// Generous boundary supporting long enterprise job postings and multi-page resumes
$resumeLength = mb_strlen($resume);
$jobLength = mb_strlen($jobDescription);

if ($resumeLength > 100000 || $jobLength > 100000) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'Payload exceeds safety threshold of 100,000 characters.'
    ], 400);
}

// 4. Gemini AI Request
$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    error_log("[API] Missing GEMINI_API_KEY. Falling back to resilient heuristic engine.");
    sendJsonResponse(calculateHeuristicMatch($resume, $jobDescription), 200);
}

$geminiModel = getEnvVar('GEMINI_MODEL', 'gemini-2.5-flash');
$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$geminiModel}:generateContent?key={$geminiApiKey}";

$prompt = <<<EOT
You are an expert ATS (Applicant Tracking System) and senior hiring manager evaluator.
Compare the provided candidate resume against the target job description.

1. Estimate alignment from 0 to 100 based only on evidence in the documents: required skills, domain knowledge, years of experience, and qualifications. This is not a real employer ATS score or hiring prediction. Never infer qualifications or accomplishments not present in the resume.
2. Identify all missing skills, missing tools, unmentioned qualifications, or key growth areas the candidate lacks for this role.
3. Keep missing skills concise (1 to 3 words each, e.g. "Docker", "GraphQL", "Kubernetes", "TypeScript").
4. List matched_skills only when supported by both documents.
5. Provide a dimensional percentage score breakdown across (omit dimensions that cannot be assessed):
   - "core_tech": Programming languages, frameworks, and web technologies (0-100)
   - "devops_cloud": Cloud platforms, infrastructure, containers, databases, and CI/CD (0-100)
   - "experience_depth": Depth of seniority, project scope, and engineering experience (0-100)
   - "domain_fit": Overall alignment with the role's domain and responsibilities (0-100)

Output strictly valid JSON matching this schema:
{
  "match_score": 85,
  "missing_skills": ["Skill 1", "Skill 2"],
  "matched_skills": ["Supported skill"],
  "breakdown": {
    "core_tech": 88,
    "devops_cloud": 75,
    "experience_depth": 82,
    "domain_fit": 90
  }
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

if (!is_array($parsedAi) || !isset($parsedAi['match_score']) || !is_numeric($parsedAi['match_score']) || !is_finite((float)$parsedAi['match_score']) || $parsedAi['match_score'] < 0 || $parsedAi['match_score'] > 100) {
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

// Only pass through dimensions actually assessed; never derive them from the total.
$breakdown = [];
$rawBreakdown = is_array($parsedAi['breakdown'] ?? null) ? $parsedAi['breakdown'] : [];
foreach (['core_tech', 'devops_cloud', 'experience_depth', 'domain_fit'] as $key) {
    $value = $rawBreakdown[$key] ?? null;
    if (is_numeric($value) && is_finite((float)$value) && $value >= 0 && $value <= 100) {
        $breakdown[$key] = (int)round((float)$value);
    }
}
$matchedSkills = [];
foreach (is_array($parsedAi['matched_skills'] ?? null) ? $parsedAi['matched_skills'] : [] as $skill) {
    if (is_string($skill) && trim($skill) !== '') $matchedSkills[] = trim($skill);
}
sendJsonResponse([
    'match_score' => $matchScore,
    'missing_skills' => array_values(array_unique($missingSkills)),
    'matched_skills' => array_values(array_unique($matchedSkills)),
    'breakdown' => (object)$breakdown,
    'source' => 'ai'
], 200);
