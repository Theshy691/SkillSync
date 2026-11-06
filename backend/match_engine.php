<?php
/** Keyword-only fallback. Measures observed technology coverage, not seniority or hiring odds. */
function calculateHeuristicMatch(string $resume, string $jobDescription): array {
    $taxonomy = [
        'React' => ['react'], 'React Native' => ['react native'], 'TypeScript' => ['typescript'],
        'JavaScript' => ['javascript'], 'Node.js' => ['node.js', 'nodejs', 'node'],
        'Next.js' => ['next.js', 'nextjs'], 'Vue' => ['vue', 'vue.js'], 'Angular' => ['angular'],
        'Svelte' => ['svelte'], 'HTML' => ['html', 'html5'], 'CSS' => ['css', 'css3'],
        'Python' => ['python'], 'Go' => ['go', 'golang'], 'Java' => ['java'], 'C++' => ['c++'],
        'C#' => ['c#'], 'PHP' => ['php'], 'Ruby' => ['ruby'], 'Rust' => ['rust'], 'SQL' => ['sql'],
        'Bash' => ['bash'], 'Docker' => ['docker'], 'Kubernetes' => ['kubernetes', 'k8s'],
        'AWS' => ['aws', 'amazon web services'], 'GCP' => ['gcp', 'google cloud'], 'Azure' => ['azure'],
        'Terraform' => ['terraform'], 'PostgreSQL' => ['postgresql', 'postgres'], 'MySQL' => ['mysql'],
        'MongoDB' => ['mongodb'], 'Redis' => ['redis'], 'GraphQL' => ['graphql'],
        'Tailwind' => ['tailwind', 'tailwind css'], 'CI/CD' => ['ci/cd', 'continuous integration'],
        'Git' => ['git'], 'GitHub Actions' => ['github actions'], 'Kafka' => ['kafka'],
        'Microservices' => ['microservices'], 'REST API' => ['rest api', 'restful'], 'Linux' => ['linux'],
        'Playwright' => ['playwright'], 'Jest' => ['jest'], 'Express' => ['express', 'express.js'],
        'FastAPI' => ['fastapi'], 'Django' => ['django'], 'Flask' => ['flask'], 'Laravel' => ['laravel'],
        'Prometheus' => ['prometheus'], 'Grafana' => ['grafana']
    ];
    $contains = static function (string $text, array $aliases): bool {
        foreach ($aliases as $alias) {
            if (preg_match('/(^|[^a-z0-9+#])' . preg_quote($alias, '/') . '(?=$|[^a-z0-9+#])/i', $text)) return true;
        }
        return false;
    };
    $matched = [];
    $missing = [];
    foreach ($taxonomy as $skill => $aliases) {
        if (!$contains($jobDescription, $aliases)) continue;
        if ($contains($resume, $aliases)) $matched[] = $skill;
        else $missing[] = $skill;
    }
    $total = count($matched) + count($missing);
    return [
        'match_score' => $total ? (int)round(count($matched) / $total * 100) : 0,
        'matched_skills' => $matched,
        'missing_skills' => $missing,
        'skill_count' => $total,
        'breakdown' => new stdClass(),
        'source' => 'keyword_fallback'
    ];
}
