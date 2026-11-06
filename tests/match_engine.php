<?php
require_once __DIR__ . '/../backend/match_engine.php';
function check(bool $condition, string $message): void {
    if (!$condition) { fwrite(STDERR, $message . "\n"); exit(1); }
}
foreach ([['React Docker', 'React Docker', 100], ['Designer', 'React Docker', 0],
    ['Node.js PostgreSQL', 'Node Postgres', 100], ['JavaScript', 'Java', 0], ['C++', 'C#', 0]] as [$resume, $job, $expected]) {
    $result = calculateHeuristicMatch($resume, $job);
    check($result['match_score'] === $expected, 'Incorrect coverage: ' . $job);
    check((array)$result['breakdown'] === [], 'Keyword matching must not invent dimensions');
    check($result['source'] === 'keyword_fallback', 'Fallback method must be explicit');
}
$unknown = calculateHeuristicMatch('Resume', 'Unrecognized role');
check($unknown['skill_count'] === 0 && $unknown['missing_skills'] === [], 'Unknown roles must remain unassessed');
$partial = calculateHeuristicMatch('React', 'React Docker');
check($partial['match_score'] === 50 && $partial['matched_skills'] === ['React'] && $partial['missing_skills'] === ['Docker'], 'Partial coverage must explain both matches and gaps');
echo "Keyword fallback regression checks passed\n";
