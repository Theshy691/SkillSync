<?php
/**
 * SkillSync - 1-Click Speedrun Application Kit Accelerator API
 * File: backend/speedrun.php
 *
 * High-velocity unified pipeline that compiles a complete job application pack:
 * 1. Targeted Resume Variant with Google XYZ bullets addressing missing skills
 * 2. Customized Cover Letter
 * 3. 300-char LinkedIn Hiring Manager Outreach DM
 * 4. Pre-configured Kanban Pipeline Entry with 5-day follow-up countdown
 */

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    sendJsonResponse([
        'error' => 'Method Not Allowed',
        'message' => 'Only POST requests are permitted.'
    ], 405);
}

// 1. Authorization & Rate Limiting
$token = getBearerToken();
$userId = 'anonymous_speedrun';

if (!empty($token)) {
    $user = verifySupabaseToken($token);
    if ($user && !empty($user['id'])) {
        $userId = $user['id'];
    }
}

enforceRateLimit($userId . '_speedrun', 20, 60);

// 2. Parse Request
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: $_POST;

$resume = trim($body['resume_text'] ?? ($body['resume'] ?? ''));
$jobTitle = trim($body['job_title'] ?? ($body['title'] ?? 'Software Engineer'));
$company = trim($body['company_name'] ?? ($body['company'] ?? 'Tech Company'));
$jobDescription = trim($body['job_description'] ?? ($body['description'] ?? ''));
$missingSkills = !empty($body['missing_skills']) && is_array($body['missing_skills'])
    ? array_filter(array_map('trim', $body['missing_skills']))
    : [];

if (empty($resume) && empty($jobDescription)) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'Resume and/or Job Description required to generate Speedrun Application Kit.'
    ], 400);
}

/**
 * Resilient Heuristic Generator (Executes in < 2ms with zero network dependency)
 */
function generateHeuristicSpeedrunKit(string $resume, string $company, string $role, string $jobDesc, array $missingSkills): array {
    $g1 = $missingSkills[0] ?? 'Distributed Systems';
    $g2 = $missingSkills[1] ?? 'Cloud Optimization';
    $g3 = $missingSkills[2] ?? 'System Reliability';

    $bullets = [
        [
            'skill' => $g1,
            'bullet' => "Architected and delivered an asynchronous data processing pipeline utilizing {$g1}, reducing p99 API latency by 44% across 18,000 requests/second.",
            'impact' => '44% latency reduction under heavy concurrent load'
        ],
        [
            'skill' => $g2,
            'bullet' => "Modernized core microservices and cloud deployment boundaries around {$g2}, improving release frequency by 3.5x while sustaining 99.98% platform SLA.",
            'impact' => '3.5x deployment frequency increase'
        ],
        [
            'skill' => $g3,
            'bullet' => "Instrumented end-to-end distributed telemetry and fault-tolerant failovers with {$g3}, reducing mean-time-to-recovery (MTTR) by 52%.",
            'impact' => '52% reduction in MTTR'
        ]
    ];

    $bulletText = implode("\n", array_map(fn($b) => "• " . $b['bullet'], $bullets));
    $highlightBlock = "\n\n[ATS TARGETED HIGHLIGHTS & QUANTIFIED ACHIEVEMENTS]\n{$bulletText}\n";

    if (preg_match('/experience|professional history|work history/i', $resume)) {
        $tailoredResume = preg_replace('/(experience|professional history|work history)/i', "$1{$highlightBlock}", $resume, 1);
    } else {
        $tailoredResume = trim($resume) . $highlightBlock;
    }

    $coverLetter = "Dear Hiring Team at {$company},\n\n"
        . "I am writing to express my strong enthusiasm for the {$role} position. With demonstrated engineering experience architecting scalable distributed systems and optimizing high-throughput production services, I am confident in my ability to immediately accelerate your team's technical roadmap.\n\n"
        . "Throughout my career, I have prioritized shipping clean, resilient code and taking ownership of end-to-end reliability. Whether implementing low-latency caching layers, streamlining automated deployment pipelines, or diagnosing production bottlenecks, I value pragmatic architecture and measurable business impact. Your team's trajectory at {$company} directly resonates with my technical philosophy.\n\n"
        . "I welcome the opportunity to discuss further how my experience aligns with {$company}'s goals. Thank you for your time and consideration.\n\n"
        . "Sincerely,\nCandidate";

    $outreachDm = "Hi! I recently applied for the {$role} opening at {$company}. With experience architecting scalable systems and reducing p99 latency by 40%+, I'd love to connect and follow your team's engineering milestones. Cheers!";
    if (mb_strlen($outreachDm) > 295) {
        $outreachDm = mb_substr($outreachDm, 0, 292) . '...';
    }

    $pipelineRecord = [
        'id' => 'pipeline-sr-' . time(),
        'company' => $company,
        'role' => $role,
        'salary' => 'Competitive',
        'date_applied' => date('Y-m-d'),
        'status' => 'Applied',
        'followup_due_days' => 5,
        'notes' => "1-Click Speedrun Kit generated for {$role} at {$company}."
    ];

    return [
        'success' => true,
        'source' => 'resilient_engine',
        'company' => $company,
        'role' => $role,
        'kit' => [
            'tailored_bullets' => $bullets,
            'tailored_resume' => $tailoredResume,
            'cover_letter' => $coverLetter,
            'outreach_dm' => $outreachDm,
            'pipeline_record' => $pipelineRecord
        ]
    ];
}

$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    sendJsonResponse(generateHeuristicSpeedrunKit($resume, $company, $jobTitle, $jobDescription, $missingSkills), 200);
}

$geminiModel = getEnvVar('GEMINI_MODEL', 'gemini-2.5-flash');
$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$geminiModel}:generateContent?key={$geminiApiKey}";
$gapsStr = !empty($missingSkills) ? implode(', ', $missingSkills) : 'System Scalability, Cloud Infrastructure';

$prompt = <<<EOT
You are an elite Tech Career Accelerator and Principal Recruiter.
Generate a high-conversion 1-Click Speedrun Application Kit for the candidate applying to {$company} for the role of {$role}.

Input:
Target Role: {$role} at {$company}
Identified Gap Skills to Highlight: {$gapsStr}
Candidate Resume Summary:
{$resume}

Job Requirements:
{$jobDescription}

Generate strictly valid JSON matching this schema:
{
  "tailored_bullets": [
    {
      "skill": "Specific Skill Name",
      "bullet": "Accomplished [X] as measured by [Y] by doing [Z] with concrete numbers",
      "impact": "Quantifiable metric phrase"
    }
  ],
  "cover_letter": "A concise, modern 3-paragraph letter without corporate fluff tailored specifically to {$company}.",
  "outreach_dm": "A polite, high-impact LinkedIn connection note strictly under 280 characters to the engineering hiring manager."
}
EOT;

$geminiPayload = [
    'contents' => [
        ['parts' => [['text' => $prompt]]]
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
    CURLOPT_TIMEOUT => 20,
    CURLOPT_SSL_VERIFYPEER => true
]);

$geminiResponse = curl_exec($geminiCurl);
$geminiHttpCode = curl_getinfo($geminiCurl, CURLINFO_HTTP_CODE);
$geminiErr = curl_error($geminiCurl);
curl_close($geminiCurl);

if ($geminiErr || $geminiHttpCode !== 200 || empty($geminiResponse)) {
    sendJsonResponse(generateHeuristicSpeedrunKit($resume, $company, $jobTitle, $jobDescription, $missingSkills), 200);
}

$geminiJson = json_decode($geminiResponse, true);
$rawAiText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';
$parsedAi = json_decode(trim($rawAiText), true);

if (!is_array($parsedAi) && preg_match('/\{[\s\S]*\}/', $rawAiText, $m)) {
    $parsedAi = json_decode($m[0], true);
}

if (!is_array($parsedAi) || empty($parsedAi['cover_letter'])) {
    sendJsonResponse(generateHeuristicSpeedrunKit($resume, $company, $jobTitle, $jobDescription, $missingSkills), 200);
}

$bullets = $parsedAi['tailored_bullets'] ?? [];
$bulletText = implode("\n", array_map(fn($b) => "• " . ($b['bullet'] ?? ''), $bullets));
$highlightBlock = "\n\n[ATS TARGETED HIGHLIGHTS & QUANTIFIED ACHIEVEMENTS]\n{$bulletText}\n";

if (preg_match('/experience|professional history|work history/i', $resume)) {
    $tailoredResume = preg_replace('/(experience|professional history|work history)/i', "$1{$highlightBlock}", $resume, 1);
} else {
    $tailoredResume = trim($resume) . $highlightBlock;
}

$outreach = trim($parsedAi['outreach_dm'] ?? '');
if (mb_strlen($outreach) > 295) {
    $outreach = mb_substr($outreach, 0, 292) . '...';
}

$pipelineRecord = [
    'id' => 'pipeline-sr-' . time(),
    'company' => $company,
    'role' => $jobTitle,
    'salary' => 'Competitive',
    'date_applied' => date('Y-m-d'),
    'status' => 'Applied',
    'followup_due_days' => 5,
    'notes' => "1-Click Speedrun Kit generated for {$jobTitle} at {$company}."
];

sendJsonResponse([
    'success' => true,
    'source' => 'gemini_ai',
    'company' => $company,
    'role' => $jobTitle,
    'kit' => [
        'tailored_bullets' => $bullets,
        'tailored_resume' => $tailoredResume,
        'cover_letter' => $parsedAi['cover_letter'],
        'outreach_dm' => $outreach,
        'pipeline_record' => $pipelineRecord
    ]
], 200);

