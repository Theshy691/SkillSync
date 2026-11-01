<?php
/**
 * SkillSync - Salary Benchmarking & AI Negotiation Coach
 * File: backend/salary.php
 *
 * Provides market salary percentiles (25th, 50th, 75th, 90th) based on role seniority,
 * location multiplier, and tech skill premiums. Also generates personalized counter-offer
 * scripts and negotiation talking points.
 */

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    sendJsonResponse([
        'error' => 'Method Not Allowed',
        'message' => 'Only POST requests are permitted.'
    ], 405);
}

// 1. Authorization
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

// 2. Rate Limiting (15 requests/minute)
enforceRateLimit($user['id'] . '_salary', 15, 60);

// 3. Parse Request
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

$role = trim($body['role'] ?? 'Software Engineer');
$location = trim($body['location'] ?? 'Remote');
$skills = is_array($body['skills'] ?? null) ? $body['skills'] : [];
$currentOfferRaw = trim((string)($body['current_offer'] ?? ''));

// Validate location (cannot contain numbers)
if (preg_match('/[0-9]/', $location)) {
    sendJsonResponse([
        'error' => 'Validation Error',
        'message' => 'Location name cannot contain numbers.'
    ], 400);
}

// Clean current offer to numeric value if present
$currentOffer = 0;
if (!empty($currentOfferRaw)) {
    $cleaned = preg_replace('/[^0-9]/', '', $currentOfferRaw);
    $currentOffer = (int)$cleaned;
}

// 4. Calculate Market Benchmarks
function calculateSalaryBenchmarks($role, $location, $skills, $currentOffer) {
    $roleLower = strtolower($role);
    $locLower = strtolower($location);

    // Baseline by seniority & role type
    $baseSalary = 115000;
    if (strpos($roleLower, 'senior') !== false || strpos($roleLower, 'sr') !== false) {
        $baseSalary = 150000;
    } elseif (strpos($roleLower, 'lead') !== false || strpos($roleLower, 'staff') !== false || strpos($roleLower, 'principal') !== false) {
        $baseSalary = 185000;
    } elseif (strpos($roleLower, 'junior') !== false || strpos($roleLower, 'jr') !== false || strpos($roleLower, 'entry') !== false) {
        $baseSalary = 85000;
    }

    if (strpos($roleLower, 'architect') !== false || strpos($roleLower, 'director') !== false) {
        $baseSalary = max($baseSalary, 195000);
    } elseif (strpos($roleLower, 'devops') !== false || strpos($roleLower, 'sre') !== false || strpos($roleLower, 'cloud') !== false) {
        $baseSalary += 12000;
    } elseif (strpos($roleLower, 'ai') !== false || strpos($roleLower, 'ml') !== false || strpos($roleLower, 'data') !== false) {
        $baseSalary += 15000;
    }

    // Location multiplier
    $locMultiplier = 1.0;
    if (strpos($locLower, 'san francisco') !== false || strpos($locLower, 'sf') !== false || strpos($locLower, 'silicon valley') !== false) {
        $locMultiplier = 1.25;
    } elseif (strpos($locLower, 'new york') !== false || strpos($locLower, 'nyc') !== false) {
        $locMultiplier = 1.20;
    } elseif (strpos($locLower, 'seattle') !== false || strpos($locLower, 'boston') !== false) {
        $locMultiplier = 1.15;
    } elseif (strpos($locLower, 'london') !== false || strpos($locLower, 'uk') !== false) {
        $locMultiplier = 0.90;
    } elseif (strpos($locLower, 'remote') !== false) {
        $locMultiplier = 1.05;
    }

    // Skill premiums
    $premiums = [];
    $skillBonus = 0;
    foreach ($skills as $s) {
        $sLower = strtolower($s);
        if ($sLower === 'aws' || $sLower === 'gcp' || $sLower === 'kubernetes' || $sLower === 'docker') {
            $skillBonus += 3000;
            $premiums[] = ['skill' => $s, 'premium' => '+4% Cloud/Infra'];
        } elseif ($sLower === 'react' || $sLower === 'next.js' || $sLower === 'typescript') {
            $skillBonus += 2500;
            $premiums[] = ['skill' => $s, 'premium' => '+3% Modern Stack'];
        } elseif ($sLower === 'python' || $sLower === 'fastapi' || strpos($sLower, 'ai') !== false) {
            $skillBonus += 3500;
            $premiums[] = ['skill' => $s, 'premium' => '+5% Systems/AI'];
        }
    }
    // Cap skill bonus to $18,000
    $skillBonus = min($skillBonus, 18000);

    $median = round(($baseSalary * $locMultiplier) + $skillBonus, -3);
    $p25 = round($median * 0.88, -3);
    $p75 = round($median * 1.14, -3);
    $p90 = round($median * 1.28, -3);

    // Offer evaluation
    $targetCounter = round($median * 1.08, -3);
    $status = 'at_market';
    $difference = 0;
    $percentDiff = 0;

    if ($currentOffer > 0) {
        $difference = $currentOffer - $median;
        $percentDiff = round(($difference / $median) * 100, 1);
        if ($currentOffer < $p25) {
            $status = 'below_market';
            $targetCounter = round($median * 1.05, -3);
        } elseif ($currentOffer > $p75) {
            $status = 'above_market';
            $targetCounter = round($currentOffer * 1.05, -3);
        } else {
            $status = 'at_market';
            $targetCounter = round(max($currentOffer * 1.07, $median * 1.08), -3);
        }
    }

    $formattedMedian = '$' . number_format($median);
    $formattedCounter = '$' . number_format($targetCounter);
    $formattedP25 = '$' . number_format($p25);
    $formattedP75 = '$' . number_format($p75);
    $formattedP90 = '$' . number_format($p90);
    $formattedCurrent = $currentOffer > 0 ? '$' . number_format($currentOffer) : 'Not specified';

    // Tailored Negotiation Script
    $script = "Dear [Hiring Manager / Recruiter],\n\n"
        . "Thank you very much for extending the offer for the {$role} position. I am enthusiastic about the opportunity to join the team and contribute to your upcoming technical milestones.\n\n"
        . ($currentOffer > 0
            ? "Based on comprehensive industry benchmarks for {$role} roles in {$location}, as well as my verified track record with " . (empty($skills) ? "modern system architecture" : implode(', ', array_slice($skills, 0, 3))) . ", I would like to propose a base salary of {$formattedCounter}.\n\n"
            : "Based on market benchmarks for this role in {$location} and my technical background in " . (empty($skills) ? "core engineering" : implode(', ', array_slice($skills, 0, 3))) . ", I am targeting a base compensation of {$formattedCounter}.\n\n")
        . "I am confident this reflects the immediate impact I will deliver to your engineering deliverables. If there is flexibility around this figure or components like sign-on bonus and equity, I would be delighted to discuss.\n\n"
        . "Thank you again for your time and support.\n\nWarm regards,\n[Your Name]";

    return [
        'success' => true,
        'role' => $role,
        'location' => $location,
        'benchmarks' => [
            'p25' => $p25,
            'median' => $median,
            'p75' => $p75,
            'p90' => $p90,
            'formatted_p25' => $formattedP25,
            'formatted_median' => $formattedMedian,
            'formatted_p75' => $formattedP75,
            'formatted_p90' => $formattedP90,
            'target_counter' => $targetCounter,
            'formatted_counter' => $formattedCounter
        ],
        'offer_analysis' => [
            'current_offer' => $currentOffer,
            'formatted_current' => $formattedCurrent,
            'status' => $status,
            'percent_diff' => $percentDiff,
            'difference' => $difference
        ],
        'skill_premiums' => array_slice($premiums, 0, 4),
        'talking_points' => [
            "Benchmark alignment: The 50th percentile market rate for {$role} in {$location} is {$formattedMedian}.",
            "Core stack leverage: Deep proficiency in " . (empty($skills) ? 'required systems' : implode(', ', array_slice($skills, 0, 3))) . " reduces ramp-up time to near zero.",
            "Counter-offer recommendation: Anchor at {$formattedCounter} (approx. 7-10% above baseline) leaving room for mutual compromise.",
            "Flexible levers: If base budget is constrained, negotiate equity grants, a one-time sign-on bonus, or an accelerated 6-month review."
        ],
        'script' => $script
    ];
}

$response = calculateSalaryBenchmarks($role, $location, $skills, $currentOffer);
sendJsonResponse($response, 200);

