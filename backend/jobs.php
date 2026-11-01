<?php
/**
 * SkillSync - Smart Tech Job Discovery Feed Service
 * File: backend/jobs.php
 *
 * Retrieves active software engineering and tech job postings from open public
 * job feeds (e.g. Arbeitnow) with 1-hour caching, query filtering, and a robust
 * offline fallback catalog for development and zero-network environments.
 */

require_once __DIR__ . '/bootstrap.php';

// Accept GET or POST
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    sendJsonResponse([
        'error' => 'Method Not Allowed',
        'message' => 'Only GET or POST requests are permitted.'
    ], 405);
}

// 1. Extract Query Parameters
$query = '';
$remoteOnly = false;
$limit = 50;

if ($method === 'GET') {
    $query = isset($_GET['q']) ? trim($_GET['q']) : (isset($_GET['query']) ? trim($_GET['query']) : '');
    $remoteOnly = isset($_GET['remote']) && filter_var($_GET['remote'], FILTER_VALIDATE_BOOLEAN);
    if (!empty($_GET['limit']) && is_numeric($_GET['limit'])) {
        $limit = max(1, min(100, (int)$_GET['limit']));
    }
} else {
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: $_POST;
    if (is_array($body)) {
        $query = isset($body['q']) ? trim($body['q']) : (isset($body['query']) ? trim($body['query']) : '');
        $remoteOnly = !empty($body['remote']);
        if (!empty($body['limit']) && is_numeric($body['limit'])) {
            $limit = max(1, min(100, (int)$body['limit']));
        }
    }
}

// 2. Cache Management
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
$cacheFile = is_dir($cacheDir) && is_writable($cacheDir)
    ? $cacheDir . '/jobs_cache.json'
    : sys_get_temp_dir() . '/skillsync_jobs_cache.json';

$cacheTtl = 3600; // 1 hour
$cachedJobs = null;
$source = 'live';

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTtl)) {
    $rawCache = @file_get_contents($cacheFile);
    if ($rawCache) {
        $decoded = json_decode($rawCache, true);
        if (is_array($decoded) && !empty($decoded)) {
            $cachedJobs = $decoded;
            $source = 'cache';
        }
    }
}

// 3. Fallback Dataset (Used when external network is restricted or offline)
function getFallbackJobListings(): array {
    return [
        [
            'id' => 'job-fallback-101',
            'title' => 'Senior Frontend Engineer (React & TypeScript)',
            'company_name' => 'Vercel',
            'location' => 'Remote (Global)',
            'remote' => true,
            'url' => 'https://vercel.com/careers',
            'tags' => ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL', 'Web Performance'],
            'salary' => '$140,000 - $185,000',
            'created_at' => date('Y-m-d', strtotime('-1 day')),
            'description' => "We are looking for a Senior Frontend Engineer to build high-performance web applications using React, Next.js, and TypeScript.\n\nKey Responsibilities:\n- Architect accessible, responsive frontend components.\n- Optimize core web vitals and frontend bundle size.\n- Collaborate with backend engineers on GraphQL and REST API design.\n\nQualifications:\n- 4+ years of production experience with React, TypeScript, and modern CSS.\n- Strong understanding of SSR, static site generation, and client-side caching.\n- Proven track record writing automated tests with Jest and Playwright."
        ],
        [
            'id' => 'job-fallback-102',
            'title' => 'Full-Stack Developer (Node.js & React)',
            'company_name' => 'Stripe',
            'location' => 'San Francisco, CA / Remote',
            'remote' => true,
            'url' => 'https://stripe.com/jobs',
            'tags' => ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS', 'REST API'],
            'salary' => '$150,000 - $195,000',
            'created_at' => date('Y-m-d', strtotime('-2 days')),
            'description' => "Stripe is seeking a Full-Stack Software Engineer to build scalable payment infrastructure and modern developer tooling.\n\nRequirements:\n- Proficient in TypeScript/JavaScript across frontend (React) and backend (Node.js).\n- Hands-on experience designing relational database schemas in PostgreSQL.\n- Experience with containerization (Docker) and AWS cloud primitives.\n- Strong background in building idempotent, secure RESTful APIs."
        ],
        [
            'id' => 'job-fallback-103',
            'title' => 'Backend Engineer (Python & Distributed Systems)',
            'company_name' => 'Datadog',
            'location' => 'New York, NY / Remote',
            'remote' => true,
            'url' => 'https://www.datadoghq.com/careers',
            'tags' => ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Kubernetes', 'Docker', 'Kafka'],
            'salary' => '$155,000 - $205,000',
            'created_at' => date('Y-m-d', strtotime('-3 days')),
            'description' => "Join Datadog to scale distributed ingestion pipelines processing millions of telemetry events per second.\n\nQualifications:\n- 3+ years experience building backend services in Python (FastAPI/Django) or Go.\n- In-depth knowledge of message brokers (Kafka/RabbitMQ) and distributed caching (Redis).\n- Experience managing workloads on Kubernetes and Docker in production.\n- Solid understanding of database indexing, query optimization, and high availability."
        ],
        [
            'id' => 'job-fallback-104',
            'title' => 'Cloud Platform & DevOps Engineer',
            'company_name' => 'HashiCorp',
            'location' => 'Remote (US & Canada)',
            'remote' => true,
            'url' => 'https://www.hashicorp.com/jobs',
            'tags' => ['Kubernetes', 'Terraform', 'Docker', 'AWS', 'CI/CD', 'Linux', 'Go', 'Bash'],
            'salary' => '$145,000 - $190,000',
            'created_at' => date('Y-m-d', strtotime('-4 days')),
            'description' => "We are looking for a DevOps Engineer to automate and harden multi-region cloud infrastructure.\n\nWhat You'll Do:\n- Maintain infrastructure-as-code using Terraform and Kubernetes Helm charts.\n- Implement automated CI/CD deployment pipelines with zero-downtime rollouts.\n- Monitor system uptime, implement automated alerting, and resolve incident alerts.\n\nRequirements:\n- 3+ years experience in cloud infrastructure (AWS/GCP), Terraform, and Docker.\n- Strong Linux systems administration and bash/shell scripting skills."
        ],
        [
            'id' => 'job-fallback-105',
            'title' => 'PHP & Laravel Backend Engineer',
            'company_name' => 'Envato',
            'location' => 'Remote (Global)',
            'remote' => true,
            'url' => 'https://www.envato.com/careers',
            'tags' => ['PHP', 'Laravel', 'MySQL', 'Redis', 'Docker', 'REST API', 'Vue.js'],
            'salary' => '$110,000 - $145,000',
            'created_at' => date('Y-m-d', strtotime('-5 days')),
            'description' => "Envato is seeking a seasoned PHP Backend Engineer to maintain and modernize high-traffic creator marketplace APIs.\n\nRequirements:\n- Strong proficiency in modern PHP (8.x) and Laravel framework.\n- Relational database schema design and performance tuning with MySQL.\n- Caching strategies using Redis and message queues.\n- Experience with automated PHPUnit testing and Dockerized environments."
        ],
        [
            'id' => 'job-fallback-106',
            'title' => 'AI Applications & Full-Stack Engineer',
            'company_name' => 'Anthropic',
            'location' => 'San Francisco, CA / Remote',
            'remote' => true,
            'url' => 'https://www.anthropic.com/careers',
            'tags' => ['Python', 'TypeScript', 'React', 'LLM', 'OpenAI', 'Vector Database', 'FastAPI'],
            'salary' => '$175,000 - $230,000',
            'created_at' => date('Y-m-d', strtotime('-1 day')),
            'description' => "Build AI-first developer interfaces, prompt evaluation suites, and agentic workflows.\n\nRequirements:\n- Proficiency in both TypeScript (React) and Python (FastAPI/LangChain).\n- Experience with LLM APIs, embeddings, vector indexing, and RAG pipelines.\n- Passion for user experience, clean interface design, and resilient async error handling."
        ],
        [
            'id' => 'job-fallback-107',
            'title' => 'Mobile Engineer (React Native & TypeScript)',
            'company_name' => 'Linear',
            'location' => 'Remote (Worldwide)',
            'remote' => true,
            'url' => 'https://linear.app/careers',
            'tags' => ['React Native', 'TypeScript', 'iOS', 'Android', 'GraphQL', 'Mobile UI'],
            'salary' => '$140,000 - $180,000',
            'created_at' => date('Y-m-d', strtotime('-2 days')),
            'description' => "Help craft the fastest, smoothest project management mobile experience on iOS and Android using React Native and TypeScript.\n\nRequirements:\n- 3+ years experience with React Native and native mobile bridges.\n- Obsession with 60fps animations, keyboard navigation, and instant touch feedback.\n- Strong understanding of offline-first synchronization and SQLite/WatermelonDB."
        ],
        [
            'id' => 'job-fallback-108',
            'title' => 'QA Automation & Test Systems Engineer',
            'company_name' => 'GitLab',
            'location' => 'Remote (Global)',
            'remote' => true,
            'url' => 'https://about.gitlab.com/jobs',
            'tags' => ['Playwright', 'Jest', 'TypeScript', 'Python', 'CI/CD', 'Automated Testing', 'Docker'],
            'salary' => '$115,000 - $150,000',
            'created_at' => date('Y-m-d', strtotime('-3 days')),
            'description' => "Design robust automated end-to-end testing frameworks and CI/CD pipelines ensuring high product reliability.\n\nRequirements:\n- 3+ years experience with automated testing tools (Playwright, Cypress, or Jest).\n- Familiarity with CI/CD integration, containerized test runners, and flaky-test quarantine.\n- Strong coding abilities in TypeScript or Python."
        ]
    ];
}

// 4. Fetch Live Jobs if Cache is Missing/Expired
$allJobs = $cachedJobs;

if (!$allJobs) {
    $liveJobs = [];
    $ch = curl_init('https://www.arbeitnow.com/api/job-board-api');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 4);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'SkillSync-JobDiscovery/1.0 (+https://github.com/Theshy691/SkillSync)');
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && !empty($response)) {
        $apiData = json_decode($response, true);
        if (!empty($apiData['data']) && is_array($apiData['data'])) {
            foreach ($apiData['data'] as $item) {
                $liveJobs[] = [
                    'id' => !empty($item['slug']) ? 'arbeitnow-' . $item['slug'] : 'arbeitnow-' . md5($item['title'] . $item['company_name']),
                    'title' => trim($item['title'] ?? 'Software Engineer'),
                    'company_name' => trim($item['company_name'] ?? 'Tech Co'),
                    'location' => trim($item['location'] ?? 'Remote'),
                    'remote' => !empty($item['remote']),
                    'url' => !empty($item['url']) ? $item['url'] : '#',
                    'tags' => !empty($item['tags']) && is_array($item['tags']) ? array_slice($item['tags'], 0, 8) : ['Tech', 'Engineering'],
                    'salary' => !empty($item['salary']) ? $item['salary'] : 'Competitive',
                    'created_at' => !empty($item['created_at']) ? date('Y-m-d', $item['created_at']) : date('Y-m-d'),
                    'description' => strip_tags($item['description'] ?? '')
                ];
            }
        }
    }

    if (!empty($liveJobs)) {
        $allJobs = $liveJobs;
        $source = 'live';
        // Persist to cache
        @file_put_contents($cacheFile, json_encode($allJobs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    } else {
        $allJobs = getFallbackJobListings();
        $source = 'fallback';
    }
}

// 5. Query Filtering & Normalization
$filteredJobs = [];
$qLower = mb_strtolower($query, 'UTF-8');

foreach ($allJobs as $job) {
    if ($remoteOnly && empty($job['remote'])) {
        continue;
    }

    if (!empty($query)) {
        $titleMatch = mb_strpos(mb_strtolower($job['title'], 'UTF-8'), $qLower) !== false;
        $companyMatch = mb_strpos(mb_strtolower($job['company_name'], 'UTF-8'), $qLower) !== false;
        $descMatch = mb_strpos(mb_strtolower($job['description'], 'UTF-8'), $qLower) !== false;
        $tagMatch = false;

        if (!empty($job['tags']) && is_array($job['tags'])) {
            foreach ($job['tags'] as $tag) {
                if (mb_strpos(mb_strtolower($tag, 'UTF-8'), $qLower) !== false) {
                    $tagMatch = true;
                    break;
                }
            }
        }

        if (!$titleMatch && !$companyMatch && !$descMatch && !$tagMatch) {
            continue;
        }
    }

    $filteredJobs[] = $job;
    if (count($filteredJobs) >= $limit) {
        break;
    }
}

// If filtered results are empty but fallback has relevant jobs, search fallback
if (empty($filteredJobs) && !empty($query)) {
    $fallbacks = getFallbackJobListings();
    foreach ($fallbacks as $job) {
        $titleMatch = mb_strpos(mb_strtolower($job['title'], 'UTF-8'), $qLower) !== false;
        $companyMatch = mb_strpos(mb_strtolower($job['company_name'], 'UTF-8'), $qLower) !== false;
        $descMatch = mb_strpos(mb_strtolower($job['description'], 'UTF-8'), $qLower) !== false;
        $tagMatch = false;
        foreach ($job['tags'] as $tag) {
            if (mb_strpos(mb_strtolower($tag, 'UTF-8'), $qLower) !== false) {
                $tagMatch = true;
                break;
            }
        }
        if ($titleMatch || $companyMatch || $descMatch || $tagMatch) {
            $filteredJobs[] = $job;
            if (count($filteredJobs) >= $limit) {
                break;
            }
        }
    }
}

sendJsonResponse([
    'success' => true,
    'source' => $source,
    'query' => $query,
    'remote_only' => $remoteOnly,
    'count' => count($filteredJobs),
    'jobs' => $filteredJobs
], 200);

