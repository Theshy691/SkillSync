<?php
/**
 * SkillSync - Tailored Cover Letter Generator
 * File: backend/coverletter.php
 *
 * Synthesizes a candidate's background, technical capabilities, and verified credentials
 * into a compelling, 3-paragraph tailored cover letter calibrated to the employer's domain.
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
enforceRateLimit($user['id'] . '_coverletter', 10, 60);

// 3. Parse Request
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$resume = '';
$jobDescription = '';
$companyName = '';
$tone = 'modern'; // modern, formal, startup

if (is_array($body)) {
    $resume = trim($body['resume'] ?? ($body['resume_text'] ?? ''));
    $jobDescription = trim($body['job_description'] ?? ($body['jobDescription'] ?? ''));
    $companyName = trim($body['company_name'] ?? ($body['company'] ?? 'the hiring team'));
    $tone = trim($body['tone'] ?? 'modern');
} else {
    $resume = trim($_POST['resume'] ?? '');
    $jobDescription = trim($_POST['job_description'] ?? '');
    $companyName = trim($_POST['company_name'] ?? 'the hiring team');
    $tone = trim($_POST['tone'] ?? 'modern');
}

if (empty($resume) || empty($jobDescription)) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'Both "resume" and "job_description" are required.'
    ], 400);
}

if (!in_array($tone, ['modern', 'formal', 'startup'])) {
    $tone = 'modern';
}

/**
 * Resilient Heuristic Cover Letter Generator
 */
function calculateHeuristicCoverLetter(string $resume, string $jobDescription, string $company, string $tone): array {
    $companySafe = htmlspecialchars($company ?: 'your engineering team', ENT_QUOTES, 'UTF-8');
    
    // Detect candidate skills
    $taxonomy = ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker', 'PostgreSQL', 'Kubernetes', 'CI/CD'];
    $matched = [];
    foreach ($taxonomy as $tech) {
        if (stripos($resume, $tech) !== false) {
            $matched[] = $tech;
        }
    }
    $skillsList = !empty($matched) ? implode(', ', array_slice($matched, 0, 4)) : 'modern full-stack engineering and cloud architecture';

    $opening = match ($tone) {
        'startup' => "I am writing to express my strong enthusiasm for joining {$companySafe}. With a proven track record delivering scalable features across {$skillsList}, I thrive in fast-paced environments where ownership, rapid iteration, and pragmatic engineering create real user value.",
        'formal' => "Please accept this letter and the accompanying credentials in application for the engineering role at {$companySafe}. Having developed a rigorous foundation across {$skillsList}, I am eager to contribute my technical acumen and disciplined engineering standards to your organization.",
        default => "I am excited to submit my application for the software engineering position at {$companySafe}. My hands-on background architecting robust solutions with {$skillsList} directly mirrors the high bar for performance, product quality, and system scalability required in this role."
    };

    $bodyParagraph = "Throughout my career, I have focused on closing the loop between complex architectural challenges and tangible business outcomes. Whether optimizing high-concurrency backend services or engineering accessible, responsive frontend interfaces, I emphasize clean abstractions, automated testing, and reliable CI/CD delivery. Exploring your technical scope and mission, I see an immediate fit for my experience modernizing infrastructure, accelerating development velocity, and collaborating closely with cross-functional product stakeholders.";

    $closing = match ($tone) {
        'startup' => "I would love the opportunity to dive deep into your current technical roadmap and discuss how my hands-on execution can accelerate {$companySafe}'s velocity. Thank you for your time, and I look forward to connecting.",
        'formal' => "Thank you for reviewing my qualifications and considering my application. I welcome the opportunity to discuss further how my professional background aligns with the strategic objectives of {$companySafe}.",
        default => "I look forward to discussing how my experience, enthusiasm for clean software design, and drive for product excellence can support {$companySafe}'s upcoming milestones. Thank you for your time and consideration."
    };

    $fullLetter = "Dear Hiring Team at {$companySafe},\n\n{$opening}\n\n{$bodyParagraph}\n\n{$closing}\n\nSincerely,\nCandidate";

    return [
        'success' => true,
        'source' => 'resilient_engine',
        'cover_letter' => $fullLetter,
        'tone' => $tone,
        'company_name' => $companySafe
    ];
}

$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    sendJsonResponse(calculateHeuristicCoverLetter($resume, $jobDescription, $companyName, $tone), 200);
}

$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$geminiApiKey}";

$prompt = <<<EOT
You are an elite career coach and tech hiring specialist.
Write a concise, compelling 3-paragraph tailored cover letter for a candidate applying to "{$companyName}".

Tone: {$tone} (Modern Tech: confident, authentic, value-driven; Startup: energetic, high-ownership, fast execution; Formal: traditional, structured, deferential).

Structure:
- Salutation: "Dear Hiring Team at {$companyName},"
- Paragraph 1: Powerful hook connecting candidate's demonstrated background to company mission.
- Paragraph 2: 2-3 specific quantifiable engineering achievements aligning with the job description.
- Paragraph 3: Forward-looking call to action and enthusiastic sign-off.
- Sign-off: "Sincerely,\nCandidate"

Output strictly valid JSON:
{
  "cover_letter": "The full formatted letter with newlines"
}

Candidate Background:
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
        'temperature' => 0.4
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
    sendJsonResponse(calculateHeuristicCoverLetter($resume, $jobDescription, $companyName, $tone), 200);
}

$geminiJson = json_decode($geminiResponse, true);
$rawAiText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';

$parsedAi = json_decode(trim($rawAiText), true);
if (!is_array($parsedAi) && preg_match('/\{[\s\S]*\}/', $rawAiText, $m)) {
    $parsedAi = json_decode($m[0], true);
}

if (!is_array($parsedAi) || empty($parsedAi['cover_letter'])) {
    sendJsonResponse(calculateHeuristicCoverLetter($resume, $jobDescription, $companyName, $tone), 200);
}

sendJsonResponse([
    'success' => true,
    'source' => 'gemini_ai',
    'cover_letter' => trim($parsedAi['cover_letter']),
    'tone' => $tone,
    'company_name' => $companyName
], 200);
