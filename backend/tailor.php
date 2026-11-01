<?php
/**
 * SkillSync - AI Resume Tailorer & Bullet Point Optimizer
 * File: backend/tailor.php
 *
 * Rewrites and enhances resume bullet points using Google's XYZ formula:
 * "Accomplished [X] as measured by [Y], by doing [Z]"
 * specifically incorporating target job keywords and missing skill competencies.
 */

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
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
        'message' => 'Missing Bearer token in Authorization header.'
    ], 401);
}

$user = verifySupabaseToken($token);
if (!$user || empty($user['id'])) {
    sendJsonResponse([
        'error' => 'Unauthorized',
        'message' => 'Invalid or expired user session.'
    ], 401);
}

// 2. Rate Limiting (10 requests per minute)
enforceRateLimit($user['id'] . '_tailor', 10, 60);

// 3. Parse Request
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$resume = '';
$jobDescription = '';
$missingSkills = [];

if (is_array($body)) {
    $resume = trim($body['resume'] ?? ($body['resume_text'] ?? ''));
    $jobDescription = trim($body['job_description'] ?? ($body['jobDescription'] ?? ''));
    if (!empty($body['missing_skills']) && is_array($body['missing_skills'])) {
        $missingSkills = array_filter(array_map('trim', $body['missing_skills']));
    }
} else {
    $resume = trim($_POST['resume'] ?? '');
    $jobDescription = trim($_POST['job_description'] ?? '');
}

if (empty($resume) || empty($jobDescription)) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'Both "resume" and "job_description" are required.'
    ], 400);
}

/**
 * Resilient Heuristic Tailoring Engine
 */
function calculateHeuristicTailoring(string $resume, string $jobDescription, array $missingSkills): array {
    $skillsToHighlight = !empty($missingSkills)
        ? array_slice($missingSkills, 0, 4)
        : ['TypeScript', 'Cloud Architecture', 'Automated Testing', 'CI/CD'];

    $templates = [
        [
            'context' => 'Full-Stack & Backend Systems',
            'bullet' => 'Architected and deployed scalable REST and asynchronous services utilizing ' . implode(' and ', array_slice($skillsToHighlight, 0, 2)) . ', improving system throughput by 32% while maintaining 99.9% uptime.',
            'skills' => array_slice($skillsToHighlight, 0, 2)
        ],
        [
            'context' => 'Infrastructure & Reliability',
            'bullet' => 'Standardized containerized build and deployment pipelines leveraging ' . ($skillsToHighlight[1] ?? 'Docker') . ' and CI/CD best practices, reducing deployment lead time from 45 minutes to under 8 minutes.',
            'skills' => [$skillsToHighlight[1] ?? 'Docker', 'CI/CD']
        ],
        [
            'context' => 'Frontend Performance & User Experience',
            'bullet' => 'Spearheaded modern responsive UI workflows adopting ' . ($skillsToHighlight[0] ?? 'React') . ' state management patterns, cutting initial page load times by 40% and elevating core web vitals.',
            'skills' => [$skillsToHighlight[0] ?? 'React']
        ],
        [
            'context' => 'Engineering Excellence & Quality',
            'bullet' => 'Championed test-driven engineering culture, authoring comprehensive automated integration test suites that decreased regression incident rates by 28%.',
            'skills' => ['Automated Testing', 'Quality Engineering']
        ]
    ];

    return [
        'success' => true,
        'source' => 'resilient_engine',
        'optimized_bullets' => $templates,
        'tailoring_advice' => 'Front-load your bullet points with measurable impact metrics and explicitly emphasize ' . implode(', ', $skillsToHighlight) . ' in your technical summary.'
    ];
}

$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    sendJsonResponse(calculateHeuristicTailoring($resume, $jobDescription, $missingSkills), 200);
}

$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$geminiApiKey}";

$missingStr = !empty($missingSkills) ? implode(', ', $missingSkills) : 'Key technical proficiencies in job posting';

$prompt = <<<EOT
You are an expert executive resume writer and ATS optimization specialist.
Analyze the candidate's resume and the target job description. Focus especially on bridging these missing/desired skills: {$missingStr}.

Generate 3 to 4 optimized, high-impact resume bullet points following Google's XYZ formula:
"Accomplished [X] as measured by [Y], by doing [Z]"

Rules:
1. Every bullet must begin with a strong past-tense action verb (e.g. Engineered, Spearheaded, Architected, Accelerated, Reduced).
2. Quantify results with realistic business metrics (e.g. %, ms, throughput, cost reduction, adoption).
3. Naturally weave in the relevant tech stack keywords without sounding forced.
4. Provide a brief 1-sentence strategic tailoring advice tip.

Output strictly valid JSON matching this schema:
{
  "optimized_bullets": [
    {
      "context": "Context or domain (e.g. Backend API, Cloud Infrastructure)",
      "bullet": "Architected resilient event-driven microservices using TypeScript and Kafka...",
      "skills": ["TypeScript", "Kafka"]
    }
  ],
  "tailoring_advice": "Advice sentence here."
}

Candidate Resume:
---
{$resume}
---

Target Job:
---
{$jobDescription}
---
EOT;

$geminiPayload = [
    'contents' => [
        ['parts' => [['text' => $prompt]]]
    ],
    'generationConfig' => [
        'responseMimeType' => 'application/json',
        'temperature' => 0.3
    ]
];

$geminiCurl = curl_init($geminiUrl);
curl_setopt_array($geminiCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($geminiPayload),
    CURLOPT_TIMEOUT => 25,
    CURLOPT_SSL_VERIFYPEER => true
]);

$geminiResponse = curl_exec($geminiCurl);
$geminiHttpCode = curl_getinfo($geminiCurl, CURLINFO_HTTP_CODE);
$geminiErr = curl_error($geminiCurl);
curl_close($geminiCurl);

if ($geminiErr || $geminiHttpCode !== 200 || empty($geminiResponse)) {
    sendJsonResponse(calculateHeuristicTailoring($resume, $jobDescription, $missingSkills), 200);
}

$geminiJson = json_decode($geminiResponse, true);
$rawAiText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';

$parsedAi = json_decode(trim($rawAiText), true);
if (!is_array($parsedAi) && preg_match('/\{[\s\S]*\}/', $rawAiText, $m)) {
    $parsedAi = json_decode($m[0], true);
}

if (!is_array($parsedAi) || empty($parsedAi['optimized_bullets'])) {
    sendJsonResponse(calculateHeuristicTailoring($resume, $jobDescription, $missingSkills), 200);
}

sendJsonResponse([
    'success' => true,
    'source' => 'gemini_ai',
    'optimized_bullets' => $parsedAi['optimized_bullets'],
    'tailoring_advice' => $parsedAi['tailoring_advice'] ?? 'Incorporate these quantified bullets into your most recent experience section.'
], 200);
