<?php
/**
 * SkillSync - Role-Specific Technical Interview Prep Generator
 * File: backend/interview.php
 *
 * Generates 5 high-probability technical, architectural, and behavioral interview questions
 * focused specifically on the candidate's skill gaps and the target company's tech stack.
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
enforceRateLimit($user['id'] . '_interview', 10, 60);

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
 * Resilient Heuristic Interview Prep Engine
 */
function calculateHeuristicInterview(string $resume, string $jobDescription, array $missingSkills): array {
    $gap1 = $missingSkills[0] ?? 'Docker';
    $gap2 = $missingSkills[1] ?? 'Cloud Architecture';
    $gap3 = $missingSkills[2] ?? 'System Scalability';

    $questions = [
        [
            'id' => 1,
            'category' => 'Skill Deep-Dive',
            'target_skill' => $gap1,
            'question' => "In your previous projects, how have you utilized {$gap1} in production, and how do you handle debugging unexpected failures or performance bottlenecks with it?",
            'interviewer_intent' => "Probing whether you have hands-on production troubleshooting experience or merely surface-level knowledge of {$gap1}.",
            'talking_points' => [
                "Cite a real scenario where {$gap1} resolved a delivery bottleneck",
                "Explain the observability metrics (logs, CPU/memory, latency) you monitor",
                "Mention rollback strategies and graceful failure handling"
            ]
        ],
        [
            'id' => 2,
            'category' => 'System Design & Tradeoffs',
            'target_skill' => $gap2,
            'question' => "How would you design a distributed, high-concurrency ingestion endpoint to guarantee zero data loss during traffic spikes?",
            'interviewer_intent' => "Evaluates your architectural maturity with asynchronous processing, message brokers (Kafka/RabbitMQ), and database backpressure.",
            'talking_points' => [
                "Decouple ingestion via durable message queues",
                "Enforce idempotent consumers with deduplication keys",
                "Implement circuit breakers and dead-letter queue retries"
            ]
        ],
        [
            'id' => 3,
            'category' => 'Engineering Reliability',
            'target_skill' => 'CI/CD & Testing',
            'question' => "Walk me through your automated testing hierarchy. How do you balance unit tests, integration tests, and end-to-end tests to ship fast without breaking production?",
            'interviewer_intent' => "Checks if you have disciplined automated testing practices and understand testing pyramid economics.",
            'talking_points' => [
                "Fast unit tests for pure domain logic with high branch coverage",
                "Containerized integration tests for database and external API boundaries",
                "Automated smoke tests run on ephemeral PR previews before production rollouts"
            ]
        ],
        [
            'id' => 4,
            'category' => 'Data Layer & Optimization',
            'target_skill' => 'Databases & Caching',
            'question' => "When an API endpoint querying a relational database suddenly slows down from 50ms to 2.5s under peak load, what is your diagnostic runbook?",
            'interviewer_intent' => "Tests real-world database profiling, EXPLAIN ANALYZE interpretation, missing indexes, and caching strategies.",
            'talking_points' => [
                "Inspect query execution plan (seq scan vs index scan)",
                "Check for connection pool exhaustion and lock contention",
                "Introduce Redis caching with TTL and cache stampede protection"
            ]
        ],
        [
            'id' => 5,
            'category' => 'Behavioral & Ambiguity',
            'target_skill' => 'Technical Leadership',
            'question' => "Tell me about a time you had to deliver an engineering milestone with incomplete requirements or an unfamiliar technology. How did you de-risk it?",
            'interviewer_intent' => "Measures autonomy, proactive communication, and ability to break down ambiguous technical tasks.",
            'talking_points' => [
                "Built a rapid time-boxed proof-of-concept to validate core assumptions",
                "Documented architectural decision records (ADRs) for team consensus",
                "Communicated milestone tradeoffs transparently to product stakeholders"
            ]
        ]
    ];

    return [
        'success' => true,
        'source' => 'resilient_engine',
        'questions' => $questions
    ];
}

$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    sendJsonResponse(calculateHeuristicInterview($resume, $jobDescription, $missingSkills), 200);
}

$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$geminiApiKey}";
$missingStr = !empty($missingSkills) ? implode(', ', $missingSkills) : 'Required modern stack competencies';

$prompt = <<<EOT
You are a Principal Software Engineer and Technical Bar Raiser at a top tier technology company.
Generate 5 realistic, incisive technical and behavioral interview questions tailored to the candidate's gap skills ({$missingStr}) and target job qualifications.

For each question, provide:
1. "category": e.g. "Architecture & Systems", "Core Stack Deep-Dive", "Reliability & Observability", "Behavioral & Leadership"
2. "target_skill": The specific skill being tested (e.g. "Kubernetes", "Redis", "TypeScript")
3. "question": A challenging, open-ended question that simulates real senior tech interviews
4. "interviewer_intent": What the interviewer is evaluating under the hood
5. "talking_points": 3 concrete bullet points the candidate should mention to ace the answer

Output strictly valid JSON:
{
  "questions": [
    {
      "id": 1,
      "category": "...",
      "target_skill": "...",
      "question": "...",
      "interviewer_intent": "...",
      "talking_points": ["Point 1", "Point 2", "Point 3"]
    }
  ]
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
    sendJsonResponse(calculateHeuristicInterview($resume, $jobDescription, $missingSkills), 200);
}

$geminiJson = json_decode($geminiResponse, true);
$rawAiText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';

$parsedAi = json_decode(trim($rawAiText), true);
if (!is_array($parsedAi) && preg_match('/\{[\s\S]*\}/', $rawAiText, $m)) {
    $parsedAi = json_decode($m[0], true);
}

if (!is_array($parsedAi) || empty($parsedAi['questions'])) {
    sendJsonResponse(calculateHeuristicInterview($resume, $jobDescription, $missingSkills), 200);
}

sendJsonResponse([
    'success' => true,
    'source' => 'gemini_ai',
    'questions' => $parsedAi['questions']
], 200);

