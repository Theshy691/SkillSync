<?php
/**
 * SkillSync - AI Resume Image OCR & Transcription Proxy
 * File: ocr.php
 *
 * Accepts resume images (PNG, JPEG, WEBP, etc.) via POST or JSON base64,
 * verifies authentication and rate limits, uses Gemini 1.5 Flash multimodal
 * vision capability to transcribe the resume into clean text, and returns JSON.
 */

require_once __DIR__ . '/bootstrap.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'error' => 'Method Not Allowed',
        'message' => 'Only POST requests are permitted.'
    ], 405);
}

// 1. Verify Authorization Header (Supports Supabase Auth & Demo Token)
$token = getBearerToken();
if (empty($token)) {
    sendJsonResponse([
        'error' => 'Unauthorized',
        'message' => 'Missing or invalid Bearer token in Authorization header.'
    ], 401);
}

$user = null;
if (str_starts_with($token, 'demo-token-')) {
    // Allow zero-setup local demo session
    $user = ['id' => 'demo-user-local', 'email' => 'demo@skillsync.ai'];
} else {
    $user = verifySupabaseToken($token);
}

if (!$user || empty($user['id'])) {
    sendJsonResponse([
        'error' => 'Unauthorized',
        'message' => 'Invalid or expired user session.'
    ], 401);
}

// 2. Enforce Rate Limiting (10 OCR requests per minute per user)
enforceRateLimit($user['id'], 10, 60);

// 3. Extract Image Data (JSON payload or multipart upload)
$base64Data = '';
$mimeType = 'image/png';

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

if (is_array($body) && !empty($body['image'])) {
    $rawImage = $body['image'];
    // Handle data URI format (e.g. data:image/png;base64,iVBORw0KGgo...)
    if (preg_match('/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/', $rawImage, $matches)) {
        $mimeType = $matches[1];
        $base64Data = $matches[2];
    } else {
        $base64Data = $rawImage;
        $mimeType = $body['mime_type'] ?? 'image/png';
    }
} elseif (!empty($_FILES['image']['tmp_name'])) {
    $fileTmp = $_FILES['image']['tmp_name'];
    $fileSize = $_FILES['image']['size'] ?? 0;

    if ($fileSize > 10 * 1024 * 1024) { // 10MB limit
        sendJsonResponse([
            'error' => 'File Too Large',
            'message' => 'The uploaded image exceeds the 10MB maximum file size.'
        ], 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $detectedMime = finfo_file($finfo, $fileTmp);
    finfo_close($finfo);

    $allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!in_array(strtolower($detectedMime), $allowedMimes, true)) {
        sendJsonResponse([
            'error' => 'Invalid File Type',
            'message' => "Unsupported image type ({$detectedMime}). Supported formats: PNG, JPEG, WEBP."
        ], 400);
    }

    $mimeType = $detectedMime;
    $rawFileBytes = file_get_contents($fileTmp);
    $base64Data = base64_encode($rawFileBytes);
}

if (empty($base64Data)) {
    sendJsonResponse([
        'error' => 'Bad Request',
        'message' => 'No image data provided. Submit an "image" base64 string or multipart file.'
    ], 400);
}

// 4. Gemini AI Multimodal OCR Request
$geminiApiKey = getEnvVar('GEMINI_API_KEY', '');
if (empty($geminiApiKey)) {
    // If no Gemini key is configured, return graceful guidance or demo fallback
    sendJsonResponse([
        'error' => 'Configuration Error',
        'message' => 'Gemini AI API key is not configured on the server. Please use client-side OCR fallback.'
    ], 500);
}

$geminiModel = getEnvVar('GEMINI_MODEL', 'gemini-2.5-flash');
$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$geminiModel}:generateContent?key={$geminiApiKey}";

$prompt = <<<EOT
You are an expert OCR transcription system specializing in resume and curriculum vitae document processing.
Transcribe and extract the full candidate resume from the provided image into clean, structured plain text.

Guidelines:
1. Accurately transcribe all contact info, summary, work history, job titles, companies, dates, bullet points, skills, tools, and education.
2. Maintain natural reading order and separate distinct sections with standard line breaks.
3. Do NOT summarize, abbreviate, or add external commentary. Output only the transcribed resume content.
EOT;

$geminiPayload = [
    'contents' => [
        [
            'parts' => [
                [
                    'text' => $prompt
                ],
                [
                    'inlineData' => [
                        'mimeType' => $mimeType,
                        'data' => $base64Data
                    ]
                ]
            ]
        ]
    ],
    'generationConfig' => [
        'temperature' => 0.1,
        'maxOutputTokens' => 2048
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
    error_log("[OCR] Gemini API error: HTTP {$geminiHttpCode} - {$geminiErr} - Response: {$geminiResponse}");
    sendJsonResponse([
        'error' => 'OCR Processing Error',
        'message' => 'Failed to transcribe resume image with Gemini AI. Please try again.'
    ], 502);
}

$geminiJson = json_decode($geminiResponse, true);
$extractedText = $geminiJson['candidates'][0]['content']['parts'][0]['text'] ?? '';

$extractedText = trim($extractedText);
if (empty($extractedText)) {
    sendJsonResponse([
        'error' => 'Extraction Error',
        'message' => 'Could not detect or extract readable text from the provided image.'
    ], 422);
}

sendJsonResponse([
    'success' => true,
    'text' => $extractedText,
    'char_count' => mb_strlen($extractedText),
    'truncated' => false
], 200);
