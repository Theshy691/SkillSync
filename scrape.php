<?php
/**
 * SkillSync - AI-Powered Job URL Scraper & Cache
 * File: scrape.php
 *
 * Verifies authenticated Supabase user, enforces per-user rate limiting,
 * checks cached job descriptions in Supabase, scrapes external job URLs,
 * cleans content using Gemini AI, saves result to cache, and returns JSON.
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

$targetUrl = '';
if (is_array($body) && !empty($body['url'])) {
    $targetUrl = trim($body['url']);
} elseif (!empty($_POST['url'])) {
    $targetUrl = trim($_POST['url']);
}

if (empty($targetUrl)) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'A valid job "url" parameter is required.'
    ], 400);
}

if (!isSafePublicUrl($targetUrl)) {
    sendJsonResponse([
        'error' => 'Invalid URL',
        'message' => 'The provided URL is invalid or targets an inaccessible private network address.'
    ], 400);
}

$supabaseUrl = rtrim(getEnvVar('SUPABASE_URL', ''), '/');
$supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY', '');
$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');

if (empty($supabaseUrl) || empty($supabaseAnonKey)) {
    error_log("[Scraper] Supabase configuration missing.");
    sendJsonResponse([
        'error' => 'Configuration Error',
        'message' => 'Supabase credentials are not configured on the server.'
    ], 500);
}

// 4. Cache Check Pass: Query scraped_jobs_cache via Supabase REST API
$encodedUrl = rawurlencode($targetUrl);
$cacheEndpoint = "{$supabaseUrl}/rest/v1/scraped_jobs_cache?url=eq.{$encodedUrl}&select=cleaned_description";

$cacheCurl = curl_init($cacheEndpoint);
curl_setopt_array($cacheCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "apikey: {$supabaseAnonKey}",
        "Authorization: Bearer {$token}",
        "Content-Type: application/json"
    ],
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$cacheResponse = curl_exec($cacheCurl);
$cacheHttpCode = curl_getinfo($cacheCurl, CURLINFO_HTTP_CODE);
$cacheError = curl_error($cacheCurl);
curl_close($cacheCurl);

if ($cacheHttpCode === 200 && !empty($cacheResponse)) {
    $cachedData = json_decode($cacheResponse, true);
    if (is_array($cachedData) && count($cachedData) > 0 && !empty($cachedData[0]['cleaned_description'])) {
        // Cache Hit!
        sendJsonResponse([
            'source' => 'cache',
            'url' => $targetUrl,
            'cleaned_description' => $cachedData[0]['cleaned_description']
        ], 200);
    }
}

// 5. Scrape Web Page Content
$pageCurl = curl_init($targetUrl);
curl_setopt_array($pageCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SkillSync/1.0',
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_ENCODING => '' // Supports gzip, deflate
]);

$html = curl_exec($pageCurl);
$pageHttpCode = curl_getinfo($pageCurl, CURLINFO_HTTP_CODE);
$pageError = curl_error($pageCurl);
curl_close($pageCurl);

if ($pageError || $pageHttpCode >= 400 || empty($html)) {
    error_log("[Scraper] Failed to fetch external URL {$targetUrl}: HTTP {$pageHttpCode} - {$pageError}");
    sendJsonResponse([
        'error' => 'Scrape Failed',
        'message' => "Unable to retrieve content from the target URL (HTTP {$pageHttpCode}). Please paste the job description manually."
    ], 400);
}

// 6. Clean HTML Content
// Remove scripts, styles, navigations, footers, and SVG elements to minimize noise
$cleanedHtml = preg_replace([
    '/<script\b[^>]*>(.*?)<\/script>/is',
    '/<style\b[^>]*>(.*?)<\/style>/is',
    '/<nav\b[^>]*>(.*?)<\/nav>/is',
    '/<footer\b[^>]*>(.*?)<\/footer>/is',
    '/<header\b[^>]*>(.*?)<\/header>/is',
    '/<svg\b[^>]*>(.*?)<\/svg>/is'
], ' ', $html);

$plainText = strip_tags($cleanedHtml);
$plainText = html_entity_decode($plainText, ENT_QUOTES | ENT_HTML5, 'UTF-8');
// Collapse redundant whitespace and newlines
$plainText = preg_replace('/[ \t]+/', ' ', $plainText);
$plainText = preg_replace('/(\r?\n){3,}/', "\n\n", $plainText);
$plainText = trim($plainText);

// Truncate raw page text to 10,000 characters before sending to AI
if (mb_strlen($plainText) > 10000) {
    $plainText = mb_substr($plainText, 0, 10000);
}

if (mb_strlen($plainText) < 50) {
    sendJsonResponse([
        'error' => 'Insufficient Content',
        'message' => 'The scraped page returned insufficient text content. Please paste the job description manually.'
    ], 400);
}

// 7. Extract & Clean via Gemini AI
if (empty($geminiApiKey)) {
    error_log("[Scraper] Missing GEMINI_API_KEY.");
    sendJsonResponse([
        'error' => 'Configuration Error',
        'message' => 'Gemini AI API key is not configured on the server.'
    ], 500);
}

$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={$geminiApiKey}";

$prompt = <<<EOT
You are an expert technical recruiter and job posting parser.
Extract the core job details from the following scraped webpage content.
Produce a clean, concise, high-value summary containing:
- Job Title & Company (if detected)
- Key Responsibilities
- Required Technical Skills & Tools
- Minimum Qualifications

Keep the final text under 4,500 characters so it fits within strict ATS bounds.
Respond strictly in JSON format matching this schema:
{
  "cleaned_description": "Cleaned summary text here..."
}

Raw Scraped Content:
{$plainText}
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
    CURLOPT_TIMEOUT => 25,
    CURLOPT_SSL_VERIFYPEER => true
]);

$geminiResponse = curl_exec($geminiCurl);
$geminiHttpCode = curl_getinfo($geminiCurl, CURLINFO_HTTP_CODE);
$geminiErr = curl_error($geminiCurl);
curl_close($geminiCurl);

if ($geminiErr || $geminiHttpCode !== 200 || empty($geminiResponse)) {
    error_log("[Scraper] Gemini API error: HTTP {$geminiHttpCode} - {$geminiErr} - Response: {$geminiResponse}");
    sendJsonResponse([
        'error' => 'AI Processing Error',
        'message' => 'Failed to process job description with Gemini AI.'
    ], 502);
}

$geminiJson = json_decode($geminiResponse, true);
$extractedText = '';

if (isset($geminiJson['candidates'][0]['content']['parts'][0]['text'])) {
    $rawAiText = trim($geminiJson['candidates'][0]['content']['parts'][0]['text']);
    // Decode JSON returned inside the response
    $parsedAi = json_decode($rawAiText, true);
    if (is_array($parsedAi) && !empty($parsedAi['cleaned_description'])) {
        $extractedText = trim($parsedAi['cleaned_description']);
    } else {
        $extractedText = $rawAiText;
    }
}

if (empty($extractedText)) {
    sendJsonResponse([
        'error' => 'Extraction Failed',
        'message' => 'Could not parse clean job requirements from the page.'
    ], 500);
}

// Ensure final description does not exceed 5000 characters
if (mb_strlen($extractedText) > 4900) {
    $extractedText = mb_substr($extractedText, 0, 4900) . '...';
}

// 8. Save to Cache Table in Supabase
$saveCacheCurl = curl_init("{$supabaseUrl}/rest/v1/scraped_jobs_cache");
curl_setopt_array($saveCacheCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "apikey: {$supabaseAnonKey}",
        "Authorization: Bearer {$token}",
        "Content-Type: application/json",
        "Prefer: resolution=merge-duplicates"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'url' => $targetUrl,
        'cleaned_description' => $extractedText
    ]),
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$saveResult = curl_exec($saveCacheCurl);
$saveHttpCode = curl_getinfo($saveCacheCurl, CURLINFO_HTTP_CODE);
curl_close($saveCacheCurl);

if ($saveHttpCode >= 400) {
    error_log("[Scraper] Warning: Failed to cache job URL {$targetUrl}. HTTP {$saveHttpCode}: {$saveResult}");
}

// 9. Return Response
sendJsonResponse([
    'source' => 'ai_extracted',
    'url' => $targetUrl,
    'cleaned_description' => $extractedText
], 200);
