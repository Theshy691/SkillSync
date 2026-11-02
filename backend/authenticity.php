<?php
/**
 * SkillSync - Resume Credibility & Anti-Hallucination Audit Backend
 * File: backend/authenticity.php
 *
 * Evaluates candidate resumes for:
 * 1. Anachronisms (e.g. claiming 10 years of Kubernetes experience before it existed)
 * 2. Unsubstantiated buzzword stuffing (skills listed without project evidence)
 * 3. Implausible metrics (e.g. 5000% speedup, 0 bugs, 5 billion users on junior tasks)
 * 4. Timeline conflicts and chronological integrity
 */

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
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
enforceRateLimit($user['id'] . '_authenticity', 15, 60);

// 3. Parse Request
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$resume = '';
$resumeTitle = 'Candidate Resume';

if (is_array($body)) {
    $resume = trim($body['resume'] ?? ($body['resume_text'] ?? ''));
    if (!empty($body['resume_title'])) {
        $resumeTitle = trim($body['resume_title']);
    }
} else {
    $resume = trim($_POST['resume'] ?? '');
    if (!empty($_POST['resume_title'])) {
        $resumeTitle = trim($_POST['resume_title']);
    }
}

if (empty($resume) || strlen($resume) < 30) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'Resume text is required and must be at least 30 characters.'
    ], 400);
}

// 4. Technology Inception Reference (Release Years)
$techBirthYears = [
    'kubernetes' => 2014,
    'k8s' => 2014,
    'docker' => 2013,
    'react' => 2013,
    'react.js' => 2013,
    'react native' => 2015,
    'next.js' => 2016,
    'nextjs' => 2016,
    'vue' => 2014,
    'vue.js' => 2014,
    'svelte' => 2016,
    'typescript' => 2012,
    'rust' => 2015,
    'swift' => 2014,
    'kotlin' => 2016,
    'flutter' => 2017,
    'graphql' => 2015,
    'tailwind' => 2017,
    'tailwindcss' => 2017,
    'fastapi' => 2018,
    'langchain' => 2022,
    'llamaindex' => 2022,
    'bun' => 2022,
    'deno' => 2018,
    'supabase' => 2020,
    'terraform' => 2014
];

$flaggedIssues = [];
$currentYear = (int)date('Y');

// 5. Check for Technology Timeline Anachronisms
foreach ($techBirthYears as $tech => $birthYear) {
    $maxPossibleYears = $currentYear - $birthYear;
    $pattern = '/(\d+)\+?\s*(?:years?|yrs?)(?:\s+(?:of|with|in))?\s+(?:experience\s+with\s+)?\b' . preg_quote($tech, '/') . '\b/i';
    if (preg_match($pattern, $resume, $matches)) {
        $claimedYears = (int)$matches[1];
        if ($claimedYears > $maxPossibleYears) {
            $flaggedIssues[] = [
                'type' => 'anachronism',
                'severity' => 'critical',
                'title' => "Chronological Anachronism: {$tech}",
                'description' => "Resume claims {$claimedYears}+ years of {$tech}, but {$tech} was created in {$birthYear} (max possible is ~{$maxPossibleYears} years).",
                'recommendation' => "Adjust claimed experience with {$tech} to no more than {$maxPossibleYears} years or emphasize depth of recent production usage."
            ];
        }
    }
}

// 6. Check for Implausible Metrics & Hyperbolic Claims
$implausiblePatterns = [
    [
        'pattern' => '/(\b\d{4,}%|\b[1-9]\d{3,}%\s*(?:increase|boost|improvement|growth))/i',
        'type' => 'implausible_metric',
        'severity' => 'warning',
        'title' => 'Suspicious Hyperbolic Metric',
        'description' => 'Unrealistic percentage gain (>1,000%) detected. Recruiters and hiring managers often treat 4-digit percentage gains as unsubstantiated hyperbole.',
        'recommendation' => 'Replace astronomical percentage multipliers with absolute baseline measurements (e.g. "reduced latency from 1.2s to 120ms").'
    ],
    [
        'pattern' => '/\b(?:100%|zero|0)\s*(?:bug|defect|error|outage|downtime)\s*(?:free|rate)?\b/i',
        'type' => 'perfectionism_trap',
        'severity' => 'warning',
        'title' => 'Perfectionism Trap',
        'description' => 'Claims of 100% bug-free delivery or zero defects trigger engineering skepticism.',
        'recommendation' => 'Frame using reliability and SLA standards instead (e.g., "Maintained 99.95% uptime SLA across 4 quarters").'
    ],
    [
        'pattern' => '/\b(?:\$?[5-9]\d{9,}|[1-9]\d{10,}\s*(?:users|dollars|revenue))\b/i',
        'type' => 'inflated_scale',
        'severity' => 'caution',
        'title' => 'Questionable Scale Metric',
        'description' => 'Extremely high scale metrics (>10 billion) without attribution may be flagged during senior tech background checks.',
        'recommendation' => 'Clarify whether the scale was company-wide aggregate or specifically impacted by your feature microservice.'
    ]
];

foreach ($implausiblePatterns as $metricCheck) {
    if (preg_match($metricCheck['pattern'], $resume)) {
        $flaggedIssues[] = [
            'type' => $metricCheck['type'],
            'severity' => $metricCheck['severity'],
            'title' => $metricCheck['title'],
            'description' => $metricCheck['description'],
            'recommendation' => $metricCheck['recommendation']
        ];
    }
}

// 7. Buzzword Density & Substantiation Audit
$commonSkills = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Go', 'Golang',
    'Rust', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'PostgreSQL',
    'MongoDB', 'Redis', 'GraphQL', 'PHP', 'Java', 'C++', 'Git', 'Linux'
];

$detectedSkills = [];
$substantiatedSkills = [];
$unsubstantiatedSkills = [];

foreach ($commonSkills as $skill) {
    if (preg_match('/\b' . preg_quote($skill, '/') . '\b/i', $resume)) {
        $detectedSkills[] = $skill;
        // Check if skill is accompanied by action verbs or metrics
        $evidencePattern = '/(?:developed|built|architected|deployed|implemented|migrated|optimized|scaled|designed|maintained|created|engineered)[^.\n]*?\b' . preg_quote($skill, '/') . '\b/i';
        $secondaryEvidence = '/\b' . preg_quote($skill, '/') . '\b[^.\n]*?(?:using|with|via|to\s+(?:reduce|improve|scale|handle|manage|automate))/i';
        
        if (preg_match($evidencePattern, $resume) || preg_match($secondaryEvidence, $resume)) {
            $substantiatedSkills[] = $skill;
        } else {
            $unsubstantiatedSkills[] = $skill;
        }
    }
}

$evidenceRatio = count($detectedSkills) > 0 ? (count($substantiatedSkills) / count($detectedSkills)) : 1.0;
if ($evidenceRatio < 0.40 && count($unsubstantiatedSkills) >= 3) {
    $flaggedIssues[] = [
        'type' => 'unsubstantiated_skills',
        'severity' => 'warning',
        'title' => 'Skill Keyword Stuffing Without Context',
        'description' => count($unsubstantiatedSkills) . ' skills (' . implode(', ', array_slice($unsubstantiatedSkills, 0, 4)) . ') appear in lists without project bullets describing their real-world application.',
        'recommendation' => 'Ensure every listed skill is backed by at least one bullet point describing a feature or architecture you delivered with it.'
    ];
}

// 8. Calculate Composite Credibility Score
$baseScore = 100;
foreach ($flaggedIssues as $issue) {
    if ($issue['severity'] === 'critical') {
        $baseScore -= 28;
    } elseif ($issue['severity'] === 'warning') {
        $baseScore -= 14;
    } else {
        $baseScore -= 7;
    }
}
$credibilityScore = max(15, min(100, $baseScore));

if ($credibilityScore >= 88) {
    $verdict = 'High Credibility';
} elseif ($credibilityScore >= 70) {
    $verdict = 'Moderate Credibility - Minor Tweaks Recommended';
} elseif ($credibilityScore >= 50) {
    $verdict = 'Elevated Risk - Review Flagged Inconsistencies';
} else {
    $verdict = 'High Risk - Contains Obvious Anachronisms or Unverifiable Claims';
}

$responsePayload = [
    'success' => true,
    'credibility_score' => $credibilityScore,
    'verdict' => $verdict,
    'flagged_issues' => $flaggedIssues,
    'substantiated_skills' => $substantiatedSkills,
    'unsubstantiated_skills' => $unsubstantiatedSkills,
    'metrics' => [
        'total_detected_skills' => count($detectedSkills),
        'substantiated_skills_count' => count($substantiatedSkills),
        'unsubstantiated_skills_count' => count($unsubstantiatedSkills),
        'evidence_ratio_percent' => (int)round($evidenceRatio * 100)
    ]
];

// 9. Optional Cloud Persistence to Supabase
$supabaseUrl = rtrim(getEnvVar('SUPABASE_URL', ''), '/');
$supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY', '');

if (!empty($supabaseUrl) && !empty($supabaseAnonKey) && !empty($user['id']) && $user['id'] !== 'demo-user-123') {
    $insertPayload = [
        'user_id' => $user['id'],
        'resume_title' => $resumeTitle,
        'credibility_score' => $credibilityScore,
        'verdict' => $verdict,
        'flagged_issues' => $flaggedIssues,
        'substantiated_skills' => $substantiatedSkills,
        'unsubstantiated_skills' => $unsubstantiatedSkills
    ];

    $ch = curl_init("{$supabaseUrl}/rest/v1/resume_credibility_audits");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($insertPayload),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$token}",
            "apikey: {$supabaseAnonKey}",
            "Content-Type: application/json",
            "Prefer: return=minimal"
        ],
        CURLOPT_TIMEOUT => 5
    ]);
    curl_exec($ch);
    curl_close($ch);
}

sendJsonResponse($responsePayload, 200);

