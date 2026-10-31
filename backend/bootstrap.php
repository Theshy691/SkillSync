<?php
/**
 * SkillSync - Shared Application Bootstrap
 * Configures production error handling, security headers, environment variables,
 * authentication verification, and per-user rate limiting.
 */

// 1. Strict Error Handling & Production Logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
$defaultLog = file_exists(__DIR__ . '/secure_php_errors.log') ? __DIR__ . '/secure_php_errors.log' : dirname(__DIR__) . '/secure_php_errors.log';
ini_set('error_log', $defaultLog);
error_reporting(E_ALL);

// Set default timezone
date_default_timezone_set('UTC');

// Convert PHP errors/warnings to exceptions for uniform handling
set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// Global Exception Handler
set_exception_handler(function (Throwable $e) {
    error_log(sprintf(
        "[%s] Uncaught %s: %s in %s:%d\nStack trace:\n%s",
        date('Y-m-d H:i:s'),
        get_class($e),
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
        $e->getTraceAsString()
    ));

    sendJsonResponse([
        'error' => 'Internal Server Error',
        'message' => 'An unexpected server error occurred. Please try again later.'
    ], 500);
});

// 2. CORS & Content-Type Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, apikey');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * Send JSON response and terminate script
 */
function sendJsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Parse and load .env file securely into environment
 */
function loadEnv(string $envPath = ''): void {
    if (empty($envPath)) {
        if (file_exists(__DIR__ . '/.env')) {
            $envPath = __DIR__ . '/.env';
        } elseif (file_exists(dirname(__DIR__) . '/.env')) {
            $envPath = dirname(__DIR__) . '/.env';
        } else {
            return;
        }
    }

    if (!file_exists($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        // Skip comments
        if (str_starts_with($line, '#') || empty($line)) {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Strip surrounding quotes
            if (
                (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                (str_starts_with($val, "'") && str_ends_with($val, "'"))
            ) {
                $val = substr($val, 1, -1);
            }

            if (!isset($_ENV[$key])) {
                $_ENV[$key] = $val;
            }
            if (!isset($_SERVER[$key])) {
                $_SERVER[$key] = $val;
            }
            putenv("{$key}={$val}");
        }
    }
}

// Load environment variables immediately
loadEnv();

/**
 * Safe environment variable retrieval
 */
function getEnvVar(string $key, ?string $default = null): ?string {
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return $_SERVER[$key];
    }
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    return $default;
}

/**
 * Extract Bearer token from incoming request headers
 */
function getBearerToken(): ?string {
    $authHeader = null;

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $authHeader = trim($headers['Authorization']);
        } elseif (isset($headers['authorization'])) {
            $authHeader = trim($headers['authorization']);
        }
    }

    if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return $matches[1];
    }

    return null;
}

/**
 * Verify token with Supabase Auth endpoint
 * Returns user object array containing 'id', 'email', etc., or null on failure.
 */
function verifySupabaseToken(string $token): ?array {
    $supabaseUrl = rtrim(getEnvVar('SUPABASE_URL', ''), '/');
    $supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY', '');

    if (empty($supabaseUrl) || empty($supabaseAnonKey)) {
        error_log("[Auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.");
        return null;
    }

    $ch = curl_init("{$supabaseUrl}/auth/v1/user");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$token}",
            "apikey: {$supabaseAnonKey}",
            "Content-Type: application/json"
        ],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        error_log("[Auth] cURL error connecting to Supabase: {$curlErr}");
        return null;
    }

    if ($httpCode === 200 && !empty($response)) {
        $user = json_decode($response, true);
        if (is_array($user) && isset($user['id'])) {
            return $user;
        }
    }

    error_log("[Auth] Supabase token verification failed with status code: {$httpCode}");
    return null;
}

/**
 * File-based Rate Limiter (Max requests per window per user)
 * Throws 429 Too Many Requests if rate limit is exceeded.
 */
function enforceRateLimit(string $userId, int $maxRequests = 5, int $windowSeconds = 60): void {
    $storageDir = is_dir(__DIR__ . '/storage/ratelimit') ? __DIR__ . '/storage/ratelimit' : dirname(__DIR__) . '/storage/ratelimit';
    if (!is_dir($storageDir)) {
        @mkdir($storageDir, 0755, true);
    }

    $userHash = hash('sha256', $userId);
    $filePath = "{$storageDir}/rate_{$userHash}.json";
    $currentTime = time();
    $cutoffTime = $currentTime - $windowSeconds;

    $fp = fopen($filePath, 'c+');
    if (!$fp) {
        // Fallback gracefully if filesystem issue occurs
        return;
    }

    if (flock($fp, LOCK_EX)) {
        $fileSize = filesize($filePath);
        $timestamps = [];

        if ($fileSize > 0) {
            $contents = fread($fp, $fileSize);
            $decoded = json_decode($contents, true);
            if (is_array($decoded)) {
                // Keep only timestamps within the current sliding window
                foreach ($decoded as $t) {
                    if (is_int($t) && $t > $cutoffTime) {
                        $timestamps[] = $t;
                    }
                }
            }
        }

        if (count($timestamps) >= $maxRequests) {
            flock($fp, LOCK_UN);
            fclose($fp);
            sendJsonResponse([
                'error' => 'Too Many Requests',
                'message' => "Rate limit exceeded. Maximum {$maxRequests} requests per minute allowed."
            ], 429);
        }

        $timestamps[] = $currentTime;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($timestamps));
        fflush($fp);
        flock($fp, LOCK_UN);
    }

    fclose($fp);
}

/**
 * Validate URL and protect against SSRF (Server-Side Request Forgery)
 */
function isSafePublicUrl(string $url): bool {
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        return false;
    }

    $parsed = parse_url($url);
    if (!$parsed || !isset($parsed['scheme']) || !isset($parsed['host'])) {
        return false;
    }

    $scheme = strtolower($parsed['scheme']);
    if (!in_array($scheme, ['http', 'https'], true)) {
        return false;
    }

    $host = $parsed['host'];
    $ip = gethostbyname($host);

    // If host cannot be resolved to an IP
    if ($ip === $host && !filter_var($host, FILTER_VALIDATE_IP)) {
        return false;
    }

    // Check if IP is in private or reserved ranges
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        return false;
    }

    // Disallow loopback / metadata service IP explicitly
    if (in_array($ip, ['127.0.0.1', '0.0.0.0', '169.254.169.254'], true)) {
        return false;
    }

    return true;
}
