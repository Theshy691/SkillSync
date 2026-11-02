<?php
/**
 * SkillSync - Role-Specific Technical Interview Prep & Multilingual AI Interviewer Engine
 * File: backend/interview.php
 *
 * Generates 5 high-probability technical, architectural, and behavioral interview questions
 * focused on candidate skill gaps, and acts as a senior technical interviewer providing
 * evaluations, grades, and "Better Answers" (STAR model) in English, Tagalog, or Taglish.
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

// 2. Rate Limiting (15 requests per minute)
enforceRateLimit($user['id'] . '_interview', 15, 60);

// 3. Parse Request
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$action = 'generate';
if (is_array($body) && !empty($body['action'])) {
    $action = trim($body['action']);
} elseif (!empty($_POST['action'])) {
    $action = trim($_POST['action']);
}

// =========================================================================
// ACTION: EVALUATE CANDIDATE ANSWER (English / Tagalog / Taglish)
// =========================================================================
if ($action === 'evaluate') {
    $question = is_array($body) ? trim($body['question'] ?? '') : trim($_POST['question'] ?? '');
    $userAnswer = is_array($body) ? trim($body['user_answer'] ?? ($body['answer'] ?? '')) : trim($_POST['user_answer'] ?? '');
    $targetSkill = is_array($body) ? trim($body['target_skill'] ?? 'System Architecture') : trim($_POST['target_skill'] ?? 'System Architecture');
    $talkingPoints = is_array($body) && !empty($body['talking_points']) && is_array($body['talking_points'])
        ? array_filter(array_map('trim', $body['talking_points']))
        : [];
    $preferredLang = is_array($body) ? trim($body['preferred_language'] ?? 'Auto') : trim($_POST['preferred_language'] ?? 'Auto');

    if (empty($question) || empty($userAnswer)) {
        sendJsonResponse([
            'error' => 'Bad Request',
            'message' => 'Both "question" and "user_answer" are required for evaluation.'
        ], 400);
    }

    // Client/server fallback function for evaluation
    $runHeuristicEval = function() use ($question, $userAnswer, $targetSkill, $talkingPoints, $preferredLang) {
        $lower = mb_strtolower($userAnswer, 'UTF-8');
        
        // Detect language
        $tlParticles = ['ang', 'ng', 'mga', 'sa', 'kami', 'namin', 'tayo', 'natin', 'ako', 'ko', 'tapos', 'yung', 'para', 'ito', 'dahil', 'noong', 'kaya', 'kung', 'at', 'ay'];
        $tlCount = 0;
        $words = preg_split('/\s+/', preg_replace('/[^a-z0-9\-áéíóúñ\s]/ui', ' ', $lower));
        $words = array_filter($words);
        foreach ($words as $w) {
            if (in_array($w, $tlParticles, true)) $tlCount++;
        }
        $ratio = count($words) > 0 ? ($tlCount / count($words)) : 0;
        $hasAffix = preg_match('/\b(nag|mag|pinag|pag)-[a-z]{3,}/i', $lower) || preg_match('/\b(inayos|napabilis|bumaba|tumaas|solusyon|resulta)\b/i', $lower);

        $detectedLang = 'English';
        if ($ratio > 0.35 && !$hasAffix) {
            $detectedLang = 'Tagalog';
        } elseif ($tlCount >= 2 || $hasAffix || $ratio >= 0.08) {
            $detectedLang = 'Taglish';
        }

        $activeLang = ($preferredLang !== 'Auto' && !empty($preferredLang)) ? $preferredLang : $detectedLang;

        // Talking points coverage
        $covered = [];
        $missing = [];
        foreach ($talkingPoints as $pt) {
            $ptWords = array_filter(preg_split('/\s+/', preg_replace('/[^a-z0-9\s]/i', '', strtolower($pt))), fn($w) => strlen($w) > 3);
            $matched = false;
            foreach ($ptWords as $pw) {
                if (strpos($lower, $pw) !== false) {
                    $matched = true;
                    break;
                }
            }
            if ($matched) {
                $covered[] = $pt;
            } else {
                $missing[] = $pt;
            }
        }

        $impactWords = ['reduce', 'reduced', 'increase', 'increased', 'optimiz', 'scale', 'built', 'architect', 'led', 'metric', 'latency', 'throughput', 'percent', '%', 'nag-implement', 'nag-deploy', 'nag-scale', 'nag-optimize', 'inayos', 'bumaba', 'tumaas', 'solusyon', 'resulta'];
        $impactMatches = 0;
        foreach ($impactWords as $iw) {
            if (strpos($lower, $iw) !== false) $impactMatches++;
        }

        $hasMetrics = preg_match('/\b\d+(\.\d+)?(%|ms|s|x|k|mb|gb|req)?\b/i', $lower);
        $pointsRatio = count($talkingPoints) > 0 ? (count($covered) / count($talkingPoints)) : 0.8;
        $covScore = (int)round($pointsRatio * 55);
        $impScore = ($impactMatches >= 2 || ($impactMatches >= 1 && $hasMetrics)) ? 25 : ($impactMatches > 0 ? 15 : 5);
        $lenScore = strlen($userAnswer) > 180 ? 20 : (strlen($userAnswer) > 80 ? 12 : 6);
        $score = min(100, max(30, $covScore + $impScore + $lenScore));

        if ($activeLang === 'Taglish') {
            $grade = $score >= 80 ? 'Napakahusay na Sagot' : ($score >= 60 ? 'Matatag na Sagot' : 'Kailangan ng Ensayo');
            $critique = $score >= 80
                ? "Napakahusay ng sagot! Nasaklaw mo ang " . count($covered) . " core points na may konkretong production impact at quantifiable metrics."
                : "Magandang sagot. Para maging pang-Staff/Lead level, dagdagan pa ng konkreto na latency benchmarks o architectural trade-offs.";
            $betterAnswer = "Sa previous project namin, nagkaroon kami ng major latency bottleneck sa {$targetSkill} tuwing peak hours. Para masolusyunan ito, nag-implement ako ng asynchronous event queues at nag-setup ng distributed caching na may idempotent keys. Dahil dito, bumaba ang p99 latency by 45% (from 800ms down to 120ms) at na-maintain ang 100% uptime.";
            $whyBetter = [
                'Malinaw ang STAR method (Situation, Task, Action, Result)',
                'May quantifiable metrics (45% latency drop, 120ms p99)',
                'Kitang-kita ang technical ownership at architectural maturity'
            ];
        } else {
            $grade = $score >= 80 ? 'Exceptional Delivery' : ($score >= 60 ? 'Strong Answer' : 'Needs Practice');
            $critique = $score >= 80
                ? "Outstanding answer covering " . count($covered) . " core talking points with quantifiable metrics and production engineering depth."
                : "Solid response. To reach Staff/Lead bar, incorporate concrete latency benchmarks and architectural failure mode mitigations.";
            $betterAnswer = "In our production system, we encountered severe latency bottlenecks around {$targetSkill} when traffic surged 3.5x. I led the architectural mitigation by implementing event-driven queues with distributed caching and idempotent request validation. As a direct result, we reduced p99 latency by 48% (from 650ms to 95ms) while sustaining 25,000 req/sec with zero data loss.";
            $whyBetter = [
                'Structured in precise STAR format (Situation, Task, Action, Result)',
                'Demonstrates measurable impact (48% latency drop, 95ms p99, 25k req/sec)',
                'Highlights proactive engineering tradeoffs and failure mitigations'
            ];
        }

        return [
            'success' => true,
            'source' => 'resilient_engine',
            'score' => $score,
            'grade' => $grade,
            'language_detected' => $detectedLang,
            'covered_points' => $covered,
            'missing_points' => $missing,
            'critique' => $critique,
            'better_answer' => [
                'star_answer' => $betterAnswer,
                'why_better' => $whyBetter
            ]
        ];
    };

    $geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
    if (empty($geminiApiKey)) {
        sendJsonResponse($runHeuristicEval(), 200);
    }

    $geminiModel = getEnvVar('GEMINI_MODEL', 'gemini-2.5-flash');
    $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$geminiModel}:generateContent?key={$geminiApiKey}";

    $pointsStr = !empty($talkingPoints) ? implode("\n- ", $talkingPoints) : "Core architectural principles and incident management";

    $evalPrompt = <<<EOT
You are a Principal Software Engineer and Technical Bar Raiser conducting an interactive mock interview.
Evaluate the candidate's response to the interview question below.

CRITICAL MULTILINGUAL & CODE-SWITCHING INSTRUCTION:
The candidate may respond in English, Tagalog, or Taglish (Filipino-English code-switching commonly used in Philippine software development, e.g. "Nag-deploy kami ng microservices gamit ang Docker at Kubernetes; nabawasan namin ang latency ng 40% at tumaas ang deployment frequency").
You MUST:
1. Understand and evaluate English, Tagalog, and Taglish with equal technical rigor and fairness.
2. DO NOT penalize the candidate for speaking in Tagalog or Taglish. Evaluate their engineering depth, architecture, and STAR structure.
3. Detect the response language accurately ("English", "Tagalog", or "Taglish").
4. Provide constructive critique and a "Better Answer" (an exemplary Staff/Senior response following the STAR model: Situation, Task, Action, Result) with hard metrics and trade-offs.

Target Question:
"{$question}"

Key Talking Points to Evaluate:
- {$pointsStr}

Candidate's Answer:
"{$userAnswer}"

Respond strictly in valid JSON matching this schema:
{
  "score": 85,
  "grade": "Exceptional Delivery" or "Strong Answer" or "Needs Practice",
  "language_detected": "English" or "Tagalog" or "Taglish",
  "covered_points": ["Point A", "Point B"],
  "missing_points": ["Point C"],
  "critique": "Actionable, constructive feedback assessing technical depth, STAR format, and metrics.",
  "better_answer": {
    "star_answer": "Exemplary senior-level answer demonstrating Situation, Task, Action, and Result with quantifiable metrics.",
    "why_better": [
      "Why Point 1 (e.g. Concrete p99 latency metric)",
      "Why Point 2 (e.g. Explicit architectural trade-offs)",
      "Why Point 3 (e.g. Clear ownership of deployment)"
    ]
  }
}
EOT;

    $geminiPayload = [
        'contents' => [
            ['parts' => [['text' => $evalPrompt]]]
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
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $geminiResponse = curl_exec($geminiCurl);
    $geminiHttpCode = curl_getinfo($geminiCurl, CURLINFO_HTTP_CODE);
    $geminiErr = curl_error($geminiCurl);
    curl_close($geminiCurl);

    if ($geminiErr || $geminiHttpCode !== 200 || empty($geminiResponse)) {
        sendJsonResponse($runHeuristicEval(), 200);
    }

    $geminiJson = json_decode($geminiResponse, true);
    $rawAiText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';
    $parsedAi = json_decode(trim($rawAiText), true);

    if (!is_array($parsedAi) && preg_match('/\{[\s\S]*\}/', $rawAiText, $m)) {
        $parsedAi = json_decode($m[0], true);
    }

    if (!is_array($parsedAi) || !isset($parsedAi['score'])) {
        sendJsonResponse($runHeuristicEval(), 200);
    }

    sendJsonResponse([
        'success' => true,
        'source' => 'gemini_ai',
        'score' => (int)$parsedAi['score'],
        'grade' => $parsedAi['grade'] ?? 'Strong Answer',
        'language_detected' => $parsedAi['language_detected'] ?? 'English',
        'covered_points' => $parsedAi['covered_points'] ?? [],
        'missing_points' => $parsedAi['missing_points'] ?? [],
        'critique' => $parsedAi['critique'] ?? 'Solid answer.',
        'better_answer' => $parsedAi['better_answer'] ?? []
    ], 200);
}

// =========================================================================
// ACTION: GENERATE QUESTIONS (Default Mode)
// =========================================================================
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
 * Resilient Heuristic Interview Prep Engine with STAR Model Exemplars
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
            ],
            'better_answer' => [
                'star_answer' => "In our production services, we containerized our microservices using {$gap1} to ensure environment parity between staging and multi-region Kubernetes clusters. When we faced container startup latency during auto-scaling events, I analyzed multi-stage build layers, stripped unused dependencies, and implemented scratch images. This reduced image size by 65% and cut pod spin-up time from 90s to 18s under heavy traffic.",
                'why_better' => [
                    "Applies the STAR framework cleanly (Problem -> Action -> Measured Result)",
                    "Includes quantifiable engineering benchmarks (65% reduction, 90s to 18s)",
                    "Demonstrates practical debugging acumen rather than abstract theory"
                ]
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
            ],
            'better_answer' => [
                'star_answer' => "I would architect the ingestion endpoint by placing an API Gateway backed by a partitioned Kafka buffer in front of our services. The HTTP layer acknowledges writes as soon as the message is committed to Kafka (p99 < 15ms), shedding direct load from relational databases. Consumers then pull in batches with idempotent key verification in Redis to prevent duplicates, while poison pill messages route automatically to a dead-letter queue.",
                'why_better' => [
                    "Separates synchronous edge ingestion from asynchronous storage",
                    "Details explicit idempotency and backpressure mechanisms",
                    "Provides a clear SLA target (p99 < 15ms) and dead-letter handling"
                ]
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
            ],
            'better_answer' => [
                'star_answer' => "We enforce an inverted testing pyramid where 70% of tests are fast in-memory unit tests executing in under 2 minutes in CI. The next 25% are containerized integration tests using Testcontainers to validate Postgres transactions and Redis caching contracts. The remaining 5% are automated Playwright synthetic smoke tests running against ephemeral staging environments before canary rollout.",
                'why_better' => [
                    "Gives precise test distribution percentages and CI budget timings",
                    "Explains isolation tools (Testcontainers) for boundary validation",
                    "Integrates testing strategy directly into deployment risk mitigation (canary)"
                ]
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
            ],
            'better_answer' => [
                'star_answer' => "My first step is pulling APM distributed traces to isolate whether the delay is queue waiting time or query execution. If database-bound, I run EXPLAIN (ANALYZE, BUFFERS) to detect sequential scans or missing compound indexes. If connection pool saturation is the cause, I check PgBouncer pool sizing. For frequently read query patterns, I implement Redis caching with probabilistic early expiration (XFetch) to prevent stampedes.",
                'why_better' => [
                    "Follows a disciplined diagnostic tree rather than jumping to random guesses",
                    "Mentions advanced profiling commands (EXPLAIN ANALYZE BUFFERS) and PgBouncer",
                    "Solves cache stampedes with sophisticated algorithms (probabilistic early expiration)"
                ]
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
            ],
            'better_answer' => [
                'star_answer' => "When tasked with integrating an unfamiliar real-time WebSockets streaming engine under an aggressive 3-week deadline, I de-risked the initiative by running a 2-day spike validating socket connection limits and memory overhead. I authored an Architectural Decision Record (ADR) outlining trade-offs between socket clusters versus server-sent events, established daily cross-functional check-ins with product, and shipped the feature on schedule with zero customer-facing bugs.",
                'why_better' => [
                    "Exemplifies proactive de-risking via time-boxed technical spikes",
                    "Uses industry-standard governance artifacts (Architectural Decision Records)",
                    "Bridges technical execution with cross-functional stakeholder transparency"
                ]
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

$geminiModel = getEnvVar('GEMINI_MODEL', 'gemini-2.5-flash');
$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$geminiModel}:generateContent?key={$geminiApiKey}";
$missingStr = !empty($missingSkills) ? implode(', ', $missingSkills) : 'Required modern stack competencies';

$prompt = <<<EOT
You are a Principal Software Engineer and Technical Bar Raiser at a top tier technology company.
Generate 5 realistic, incisive technical and behavioral interview questions tailored to the candidate's gap skills ({$missingStr}) and target job qualifications.

NOTE: This mock interview platform supports candidates speaking in English, Tagalog, and Taglish (Filipino-English code-switching).
For each question, provide:
1. "category": e.g. "Architecture & Systems", "Core Stack Deep-Dive", "Reliability & Observability", "Behavioral & Leadership"
2. "target_skill": The specific skill being tested (e.g. "Kubernetes", "Redis", "TypeScript")
3. "question": A challenging, open-ended question that simulates real senior tech interviews
4. "interviewer_intent": What the interviewer is evaluating under the hood
5. "talking_points": 3 concrete bullet points the candidate should mention to ace the answer
6. "better_answer": An exemplary Staff/Senior response following the STAR model (Situation, Task, Action, Result) with:
   - "star_answer": The full exemplary response containing quantifiable metrics and architectural choices
   - "why_better": 3 bullet points explaining why this answer beats an average answer

Output strictly valid JSON:
{
  "questions": [
    {
      "id": 1,
      "category": "...",
      "target_skill": "...",
      "question": "...",
      "interviewer_intent": "...",
      "talking_points": ["Point 1", "Point 2", "Point 3"],
      "better_answer": {
        "star_answer": "...",
        "why_better": ["Reason 1", "Reason 2", "Reason 3"]
      }
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
