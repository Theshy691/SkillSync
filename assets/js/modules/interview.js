/**
 * SkillSync - Interactive Mock Interview Answer Simulator Engine
 * File: assets/js/modules/interview.js
 *
 * Universal UMD module for analyzing and scoring candidate behavioral & technical
 * answers against key talking points, STAR methodology metrics, and production keywords.
 * Natively supports trilingual evaluation: English, Tagalog, and Taglish (Filipino-English code-switching).
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.SkillSyncInterview = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // English impact verbs and technical nouns
  const IMPACT_KEYWORDS = [
    'reduce', 'reduced', 'increase', 'increased', 'optimiz', 'scale', 'built',
    'architect', 'led', 'deliver', 'metric', 'latency', 'throughput', 'percent',
    '%', 'test', 'monitor', 'failover', 'refactor', 'cache', 'pipeline',
    'concurrency', 'idempotent', 'microservices', 'bottleneck', 'resilient'
  ];

  // Tagalog & Taglish code-switching stems and technical action verbs
  const TAGALOG_IMPACT_KEYWORDS = [
    'nag-implement', 'nag-deploy', 'nag-scale', 'nag-optimize', 'nag-refactor',
    'nag-lead', 'nag-ayos', 'inayos', 'bumaba', 'tumaas', 'napabilis', 'napataas',
    'solusyon', 'resulta', 'sistema', 'arkitektura', 'proyekto', 'porsyento',
    'subok', 'nag-monitor', 'nag-handle', 'nag-solve', 'matagumpay', 'nagbawas',
    'nadagdagan', 'mas mabilis', 'mas matipid', 'problema', 'nag-setup', 'nag-migrate',
    'nag-integrate', 'sinolusyunan', 'binago', 'nag-test', 'nag-push', 'tinanggal',
    'pina-scale', 'na-resolve', 'na-fix', 'na-encounter', 'walang downtime',
    'nag-crash', 'bumagsak', 'nag-spike', 'na-deadlock', 'nag-rollback', 'na-mitigate',
    'nag-cache', 'nag-benchmark', 'naglunsad', 'pinangunahan'
  ];

  // Common Tagalog function particles to identify language modality
  const TAGALOG_PARTICLES = [
    'ang', 'ng', 'mga', 'sa', 'kami', 'namin', 'tayo', 'natin', 'ako', 'ko',
    'tapos', 'yung', 'para', 'ito', 'dahil', 'noong', 'kaya', 'kung', 'lahat',
    'at', 'ay', 'siya', 'nila', 'sila', 'nito', 'noon', 'bago', 'habang',
    'kasi', 'so', 'din', 'rin', 'naman', 'paano', 'saka', 'pagkatapos'
  ];

  /**
   * Rich synthetic training & exemplar corpus for real-world software engineering interviews
   * Supports seamless English, Taglish (Filipino code-switching), and formal Tagalog.
   */
  const SYNTHETIC_INTERVIEW_CORPUS = [
    {
      id: 'syn-concurrency-01',
      category: 'System Architecture & Concurrency',
      target_skill: 'High Concurrency & Redis Caching',
      question: 'How do you design an idempotent distributed system that handles sudden 10x traffic surges without database contention?',
      question_taglish: 'Paano mo ididisenyo ang isang idempotent distributed system kapag nag-spike ang traffic ng 10x nang hindi nagko-cause ng database deadlocks?',
      question_tagalog: 'Paano mo ididisenyo ang isang matatag na sistemang namamahagi upang mapangasiwaan ang 10x na pagdami ng trapiko nang walang pagbagal sa database?',
      talking_points: [
        'Decouple heavy writes with an asynchronous message queue (e.g., Kafka / SQS)',
        'Implement distributed Redis caching with unique transaction idempotency keys',
        'Protect downstream services using connection pooling, circuit breakers, and read replicas'
      ],
      synthetic_exemplars: {
        taglish: 'Sa previous company namin, nagkaroon kami ng major bottleneck noong nag-spike ang traffic by 10x during a live campaign. Para ma-solve ito, nag-implement ako ng asynchronous queue gamit ang SQS at nag-setup ng distributed Redis caching layer with unique idempotency keys para ma-block ang duplicate writes. Nilagyan din namin ng PgBouncer connection pool at circuit breakers. Dahil dito, bumaba ang p99 API latency ng 45% (from 850ms down to 110ms) at na-maintain namin ang 100% uptime kahit umabot sa 22,000 req/sec.',
        tagalog: 'Sa aming nakaraang proyekto, hinarap namin ang matinding pagbagal ng sistema nang tumaas nang 10x ang mga kahilingan. Bilang solusyon, pinangunahan ko ang paglalatag ng asynchronous queue upang ihiwalay ang proseso ng pagsulat, at nagpatupad ng mabisang Redis caching na may natatanging idempotency keys. Bunga nito, napabilis namin ang tugon ng sistema nang 45% at nanatiling matatag ang serbisyo nang walang anumang pagkabigo.',
        english: 'In our production environment, we mitigated sudden 10x traffic surges by decoupling database ingestion using asynchronous message queues. We introduced distributed Redis caching with transaction idempotency keys to eliminate duplicate write mutations, while utilizing PgBouncer connection pooling and circuit breakers to protect downstream databases. This reduced p99 latency by 45% and sustained 22,000 requests per second with zero downtime.'
      },
      loop_around_prompts: {
        taglish: 'Loop-Around Challenge: Maganda ang binanggit mong paggamit ng Redis at queues. Pero paano mo naman ima-manage ang cache stampede (kapag sabay-sabay nag-expire ang cache keys) at network partition sa Redis cluster? Paano mo sisiguruhin na hindi babagsak ang PostgreSQL database?',
        tagalog: 'Pag-ikot ng Pagsasanay: Mahusay ang iyong paunang tugon. Ngunit paano mo naman mapangangasiwaan kung magkaroon ng pagkabigo sa Redis cluster upang hindi magdagsaan ang lahat ng kahilingan sa pangunahing database?',
        english: 'Loop-Around Challenge: Strong explanation on queuing and caching. However, how would you specifically handle cache stampedes when hot keys expire, or mitigate network partitions across your distributed cache without overwhelming the primary database?'
      }
    },
    {
      id: 'syn-database-02',
      category: 'Database & Reliability',
      target_skill: 'PostgreSQL Deadlock Mitigation & Scaling',
      question: 'When high-frequency transaction updates start causing PostgreSQL deadlocks and latency degradation, what is your diagnostic and resolution protocol?',
      question_taglish: 'Kapag nagkakaroon ng PostgreSQL deadlocks at mabagal na queries dahil sa sabay-sabay na updates, ano ang step-by-step diagnostic at solusyon mo?',
      question_tagalog: 'Kapag nagkakaroon ng mga deadlock at pagbagal sa PostgreSQL dulot ng magkakasabay na transaksyon, ano ang iyong paraan ng pagsusuri at lunas?',
      talking_points: [
        'Analyze lock graphs via pg_stat_activity and lock timeout telemetry',
        'Enforce deterministic row locking order across application transactions',
        'Split long-running queries, introduce index covering, and offload read workloads'
      ],
      synthetic_exemplars: {
        taglish: 'Kapag may deadlock sa PostgreSQL, inuuna kong i-inspect ang pg_stat_activity at deadlock telemetry logs para makita kung aling transactions ang nag-aagawan ng row-level locks. Sa application code, inayos ko ang locking order para maging deterministic (halimbawa, pag-lock ng parent table bago ang child records gamit ang SELECT FOR UPDATE). Nag-refactor din kami ng long-running transactions at nag-add ng composite indexes. Na-eliminate nito ang deadlocks and bumaba ang transaction duration ng 60%.',
        tagalog: 'Upang masuri ang mga deadlock sa database, sinusuri ko muna ang pg_stat_activity at mga log ng transaksyon. Pagkatapos ay isinaayos ko ang pagkakasunod-sunod ng pag-lock sa bawat transaksyon upang maging maayos at deterministic. Naglagay din kami ng mga tamang index upang mapabilis ang paghahanap ng datos.',
        english: 'My diagnostic protocol begins by analyzing pg_stat_activity and lock contention graphs to identify the conflicting transactions and query statements. To resolve the root cause, I enforce strict deterministic row-locking ordering across application mutations, decrease transaction hold times, and introduce covering indexes. This eliminated 100% of production deadlocks and reduced average query latency by 60%.'
      },
      loop_around_prompts: {
        taglish: 'Loop-Around Challenge: Malinaw ang deterministic locking order na sinabi mo. Pero paano mo iha-handle kapag kailangang mag-run ng heavy batch migrations o analytics queries sa parehong table nang hindi naapektuhan ang live user transactions?',
        tagalog: 'Pag-ikot ng Pagsasanay: Maganda ang pagsasaayos ng locks. Subalit paano mo naman isasagawa ang malalaking data migration nang hindi nagdudulot ng table locks sa aktibong mga transaksyon ng mga gumagamit?',
        english: 'Loop-Around Challenge: Excellent explanation of deterministic locking. How would you now execute a multi-million row table migration or backfill on that same table without locking out live production writes?'
      }
    },
    {
      id: 'syn-incident-03',
      category: 'Incident Response & Production Triage',
      target_skill: 'Incident Triage & Canary Rollbacks',
      question: 'Your microservices cluster suddenly reports a 10x error rate spike immediately following a canary release. Walk me through your triage rhythm.',
      question_taglish: 'Biglang tumaas ng 10x ang error rate ng microservices cluster pagkatapos mag-deploy ng canary release. Ano ang step-by-step triage rhythm mo?',
      question_tagalog: 'Biglang tumaas nang 10x ang dami ng error sa inyong sistema matapos ang paglalabas ng bagong bersyon. Paano mo ito sisiyasatin at aayusin?',
      talking_points: [
        'Execute immediate automated or manual canary traffic rollback to protect users within SLA',
        'Isolate telemetry traces, recent git diffs, and database schema migrations',
        'Conduct blameless post-mortem with preventative canary health gates'
      ],
      synthetic_exemplars: {
        taglish: 'Unang priority ko kapag nag-spike ang errors after a canary deployment ay customer protection: agad naming i-roll back ang canary traffic pabalik sa stable baseline version within our 2-minute SLA. Pagkatapos ma-stabilize ang production, i-inspeksyunin ko ang Datadog/APM traces at recent git commit diffs para ma-isolate ang exact stack trace. Pagkatapos, nagka-conduct kami ng blameless post-mortem at nag-implement ng automated health check gates bago mag-promote ng release.',
        tagalog: 'Ang aking unang hakbang ay ang agarang pag-rollback sa nakaraang matatag na bersyon upang maprotektahan ang mga gumagamit. Matapos maging matatag ang sistema, sinisiyasat ko ang mga talaan ng error at kamakailang pagbabago sa code upang matukoy ang sanhi.',
        english: 'My immediate priority during a canary error spike is rapid mitigation: I trigger an immediate rollback of the canary traffic to the stable production baseline within our 2-minute SLA. Once service stability is verified, I analyze APM distributed traces and commit diffs to isolate the failure, followed by conducting a blameless post-mortem and adding automated pre-promotion health gates.'
      },
      loop_around_prompts: {
        taglish: 'Loop-Around Challenge: Mabilis ang rollback na sinabi mo, tama iyon. Pero paano kung ang deployment ay may kasamang backward-incompatible database schema migration? Paano mo iha-handle ang rollback nang hindi nasisira ang live database schema?',
        tagalog: 'Pag-ikot ng Pagsasanay: Tama ang mabilis na rollback. Ngunit paano kung ang bagong bersyon ay nagbago na ng istruktura ng database? Paano mo ito maibabalik nang ligtas?',
        english: 'Loop-Around Challenge: Prompt rollback is critical. However, what if the faulty release also executed an irreversible or backward-incompatible database migration? How do you ensure schema forward/backward compatibility?'
      }
    }
  ];

  // Common English function words used to determine code-switching modality
  const ENGLISH_FUNCTION_WORDS = [
    'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'with', 'from',
    'by', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'we', 'our', 'us', 'i', 'my', 'me', 'you', 'your', 'they', 'their', 'them',
    'this', 'that', 'these', 'those', 'and', 'but', 'or', 'so', 'because', 'when',
    'where', 'how', 'what', 'which', 'who', 'can', 'could', 'will', 'would', 'have', 'had'
  ];

  /**
   * Detects whether an answer is English, Tagalog, or Taglish
   * @param {string} text - Candidate response text
   * @returns {'English' | 'Tagalog' | 'Taglish'}
   */
  function detectAnswerLanguage(text) {
    if (!text || typeof text !== 'string') return 'English';
    const lower = text.toLowerCase();
    const words = lower.replace(/[^a-z0-9\-áéíóúñ\s]/gi, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'English';

    let tagalogCount = 0;
    let englishCount = 0;
    let hasTaglishAffix = false;

    words.forEach(w => {
      if (TAGALOG_PARTICLES.includes(w) || TAGALOG_IMPACT_KEYWORDS.includes(w)) {
        tagalogCount++;
      }
      if (/^(nag|mag|pinag|pag|ipag)-[a-z]{3,}/i.test(w)) {
        hasTaglishAffix = true;
        tagalogCount++;
      }
      if (ENGLISH_FUNCTION_WORDS.includes(w) || IMPACT_KEYWORDS.includes(w)) {
        englishCount++;
      }
    });

    // If no Tagalog markers found at all, it's English
    if (tagalogCount === 0 && !hasTaglishAffix) {
      return 'English';
    }

    // If Tagalog markers exist and English structural words are virtually absent, it's Tagalog
    if (tagalogCount >= 2 && englishCount === 0) {
      return 'Tagalog';
    }

    // If both Tagalog markers/affixes and English vocabulary coexist, it's Taglish
    if ((tagalogCount >= 1 || hasTaglishAffix) && englishCount >= 1) {
      return 'Taglish';
    }

    // High proportion of Tagalog markers
    const tagalogRatio = tagalogCount / words.length;
    if (tagalogRatio > 0.25 && englishCount <= 1) {
      return 'Tagalog';
    }

    return tagalogCount >= 1 ? 'Taglish' : 'English';
  }

  /**
   * Generates an exemplary STAR model answer for a question in the requested language
   * @param {Object} questionObj - Question data
   * @param {'English' | 'Tagalog' | 'Taglish'} language - Preferred target language
   * @returns {Object} { star_answer: string, situation_task: string, action: string, result: string, why_better: string[] }
   */
  function generateModelAnswer(questionObj = {}, language = 'English') {
    const skill = questionObj.target_skill || 'System Architecture';
    const points = Array.isArray(questionObj.talking_points) && questionObj.talking_points.length > 0
      ? questionObj.talking_points
      : ['Decouple dependencies with asynchronous workers', 'Implement caching and idempotency', 'Instrument end-to-end telemetry'];

    if (language === 'Taglish') {
      const situation = `Sa previous production project namin, nagkaroon kami ng major bottleneck around ${skill} noong nag-spike ang traffic by 3x during peak hours.`;
      const action = `Para masolusyunan ito, nag-implement ako ng ${points[0] || 'asynchronous queue'} at nag-setup ng ${points[1] || 'distributed Redis caching layer'} with idempotent consumers. Nag-add din kami ng structured telemetry metrics para agad ma-detect ang connection spikes.`;
      const result = `Dahil dito, bumaba ang p99 API latency by 45% (from 850ms down to 120ms), na-eliminate ang database deadlocks, at 100% uptime ang na-maintain kahit umabot sa 20,000 req/sec.`;
      const fullAnswer = `${situation} ${action} ${result}`;

      return {
        language: 'Taglish',
        star_answer: fullAnswer,
        situation_task: situation,
        action: action,
        result: result,
        why_better: [
          'Ginamit ang STAR method (Situation, Task, Action, Result) na malinaw ang role mo',
          'May konkreto at quantified metrics (bumaba ang latency ng 45%, 120ms, 20k req/sec)',
          'Malinaw ang technical ownership sa pag-implement ng architecture solutions'
        ]
      };
    } else if (language === 'Tagalog') {
      const situation = `Sa aming nakaraang proyekto, humarap ang aming koponan sa matinding pagbagal ng sistema kaugnay ng ${skill} noong dumami ang aktibong gumagamit.`;
      const action = `Bilang tugon, pinangunahan ko ang paglalatag ng ${points[0] || 'asynchronous processing'} at nagpatupad ng ${points[1] || 'mabisang caching'} upang maiwasan ang paulit-ulit na pagkuha ng datos sa database.`;
      const result = `Bunga nito, napabilis namin ang tugon ng sistema nang mahigit 40%, natanggal ang mga pagkabigo sa transaksyon, at nanatiling matatag ang serbisyo nang walang downtime.`;
      const fullAnswer = `${situation} ${action} ${result}`;

      return {
        language: 'Tagalog',
        star_answer: fullAnswer,
        situation_task: situation,
        action: action,
        result: result,
        why_better: [
          'Kompletong balangkas ng STAR na nagpapakita ng malinaw na pagkasunod-sunod',
          'Tukoy na sukatan ng tagumpay at matatag na epekto sa negosyo',
          'Propesyonal na paglalahad ng mga teknikal na hakbang at pagpapasya'
        ]
      };
    } else {
      // English default
      const situation = `In our production environment, we experienced critical latency bottlenecks around ${skill} when traffic surged 3.5x during high-volume customer campaigns.`;
      const action = `I led the redesign by implementing ${points[0] || 'event-driven message queues'} to decouple the ingestion pipeline, introduced ${points[1] || 'distributed caching with idempotent key validation'}, and configured automated circuit breakers to protect downstream databases.`;
      const result = `As a direct result, we reduced p99 endpoint latency by 48% (from 650ms to 95ms), supported over 25,000 concurrent requests without failure, and prevented approximately $120,000 in monthly compute over-provisioning costs.`;
      const fullAnswer = `${situation} ${action} ${result}`;

      return {
        language: 'English',
        star_answer: fullAnswer,
        situation_task: situation,
        action: action,
        result: result,
        why_better: [
          'Structured precisely in STAR format (Situation, Task, Action, Result)',
          'Includes hard quantifiable engineering metrics (48% latency drop, 95ms p99, 25k req/sec)',
          'Demonstrates high-impact technical ownership and architectural trade-off awareness'
        ]
      };
    }
  }

  /**
   * Evaluates an interview answer across English, Tagalog, and Taglish
   * @param {Object} questionObj - Question data
   * @param {string} userAnswer - Candidate response text
   * @param {Object} options - { preferredLanguage: 'Auto' | 'English' | 'Tagalog' | 'Taglish' }
   * @returns {Object} Evaluation report including score, grade, points, better answer, and critique
   */
  function evaluateInterviewAnswer(questionObj = {}, userAnswer = '', options = {}) {
    const answer = String(userAnswer || '').trim();
    const talkingPoints = Array.isArray(questionObj.talking_points) ? questionObj.talking_points : [];
    
    // Determine language
    const detectedLanguage = detectAnswerLanguage(answer);
    const targetLanguage = (options.preferredLanguage && options.preferredLanguage !== 'Auto')
      ? options.preferredLanguage
      : detectedLanguage;

    const modelAnswerObj = generateModelAnswer(questionObj, targetLanguage);

    if (!answer || answer.length < 15) {
      const briefCritique = targetLanguage === 'Taglish'
        ? 'Masyadong maikli ang sagot. Gamitin ang STAR method: ipaliwanag ang Situation, Task, mga Actions na ginawa mo, at ang measurable Results.'
        : (targetLanguage === 'Tagalog'
          ? 'Masyadong maikli ang tugon. Idetalye ang sitwasyon, iyong ginawa, at ang nasukat na resulta.'
          : 'Response is too brief. Provide technical specifics detailing Situation, Task, Action taken, and measurable Results.');

      return {
        score: 20,
        grade: targetLanguage === 'English' ? 'Needs Practice' : 'Kailangan ng Ensayo',
        language_detected: detectedLanguage,
        coveredPoints: [],
        missingPoints: talkingPoints,
        critique: briefCritique,
        better_answer: modelAnswerObj
      };
    }

    const lowerAnswer = answer.toLowerCase();
    const covered = [];
    const missing = [];

    // Evaluate talking points coverage
    talkingPoints.forEach(pt => {
      const words = pt.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => lowerAnswer.includes(w));
      if (matches.length >= 1) {
        covered.push(pt);
      } else {
        missing.push(pt);
      }
    });

    // Check impact keywords across English and Tagalog/Taglish sets
    const enImpactMatches = IMPACT_KEYWORDS.filter(k => lowerAnswer.includes(k));
    const tlImpactMatches = TAGALOG_IMPACT_KEYWORDS.filter(k => lowerAnswer.includes(k));
    const totalImpactMatches = enImpactMatches.length + tlImpactMatches.length;

    // Check for numerical metrics (e.g. 40%, 150ms, 10x, 2000, 3x)
    const hasNumericMetrics = /\b\d+(?:\.\d+)?(?:\%|ms|s|x|k|mb|gb|req)?\b/i.test(lowerAnswer);
    const hasStrongImpact = totalImpactMatches >= 2 || (totalImpactMatches >= 1 && hasNumericMetrics);

    const pointsRatio = talkingPoints.length > 0 ? (covered.length / talkingPoints.length) : 0.8;
    const coverageScore = Math.round(pointsRatio * 55);
    const impactScore = hasStrongImpact ? 25 : (totalImpactMatches > 0 ? 15 : 5);
    const lengthScore = answer.length > 180 ? 20 : (answer.length > 80 ? 12 : 6);

    const score = Math.min(100, Math.max(30, coverageScore + impactScore + lengthScore));

    let grade = 'Needs Practice';
    let critique = '';

    if (score >= 80) {
      grade = targetLanguage === 'English' ? 'Exceptional Delivery' : 'Napakahusay na Sagot';
      critique = targetLanguage === 'Taglish'
        ? `Napakahusay! Nasagot mo ang ${covered.length} sa ${talkingPoints.length} core talking points with quantifiable metrics at malinaw na impact.`
        : (targetLanguage === 'Tagalog'
          ? `Natatanging pagpapaliwanag! Naisama mo ang ${covered.length} sa ${talkingPoints.length} mahahalagang punto kasama ang mga datos ng tagumpay.`
          : `Excellent response covering ${covered.length} of ${talkingPoints.length} core talking points with quantifiable metrics and production impact.`);
    } else if (score >= 60) {
      grade = targetLanguage === 'English' ? 'Strong Answer' : 'Matatag na Sagot';
      critique = targetLanguage === 'Taglish'
        ? `Magandang sagot! Naipaliwanag mo ang ${covered.length} key points. Para mas maging pang-Staff/Lead level, dagdagan pa ng konkreto na latency benchmarks o architecture trade-offs.`
        : (targetLanguage === 'Tagalog'
          ? `Mabuting sagot na sumasaklaw sa ${covered.length} punto. Upang higit na mapataas, maglagay ng tiyak na sukatan ng latency o mga tradeoff sa arkitektura.`
          : `Solid answer covering ${covered.length} key points. To achieve Staff/Lead level, incorporate concrete latency benchmarks or architectural trade-offs.`);
    } else {
      grade = targetLanguage === 'English' ? 'Needs Practice' : 'Kailangan ng Ensayo';
      const missingHint = missing.slice(0, 2).join(' at ');
      critique = targetLanguage === 'Taglish'
        ? `Nabanggit ang ${covered.length} sa ${talkingPoints.length} konsepto. Siguraduhing ma-highlight: ${missingHint || 'konkretong teknikal na solusyon'}.`
        : (targetLanguage === 'Tagalog'
          ? `Tinalakay ang ${covered.length} sa ${talkingPoints.length} konsepto. Siguruhing masubukan ding talakayin ang: ${missingHint || 'mga teknikal na solusyon'}.`
          : `Addressed ${covered.length} of ${talkingPoints.length} concepts. Make sure to cover: ${missing.slice(0, 2).join(' and ')}.`);
    }

    return {
      score,
      grade,
      language_detected: detectedLanguage,
      coveredPoints: covered,
      missingPoints: missing,
      critique,
      better_answer: modelAnswerObj
    };
  }

  /**
   * Helper to construct a custom interview question object
   * @param {string} question - Question prompt
   * @param {string} targetSkill - Focus competency
   * @param {string} category - Category
   * @param {string[]} talkingPoints - Suggested talking points
   */
  function createCustomInterviewQuestion(question, targetSkill = 'Core Competency', category = 'Custom Practice', talkingPoints = []) {
    const qText = String(question || '').trim();
    const skill = String(targetSkill || 'Core Competency').trim();
    const cat = String(category || 'Custom Practice').trim();
    
    let defaultPoints = Array.isArray(talkingPoints) && talkingPoints.length > 0 ? talkingPoints : [];
    if (defaultPoints.length === 0) {
      defaultPoints = [
        `Clarify the core architectural requirements and scope for ${skill}`,
        `Walk through step-by-step technical implementation and trade-offs`,
        `Demonstrate measurable business outcomes and incident monitoring`
      ];
    }

    return {
      id: 'custom-' + Date.now(),
      category: cat,
      target_skill: skill,
      question: qText,
      interviewer_intent: `Assesses hands-on proficiency, problem-solving structure, and architectural communication around ${skill}.`,
      talking_points: defaultPoints,
      is_custom: true
    };
  }

  /**
   * Finds a matched synthetic question from the corpus based on skill or keyword query
   * @param {string} query - Target skill or question query
   * @param {'English' | 'Tagalog' | 'Taglish'} language - Preferred language
   * @returns {Object|null}
   */
  function findSyntheticQuestion(query = '', language = 'English') {
    if (!query) return SYNTHETIC_INTERVIEW_CORPUS[0] || null;
    const qLower = String(query).toLowerCase();

    const matched = SYNTHETIC_INTERVIEW_CORPUS.find(item => {
      const skillMatch = item.target_skill.toLowerCase().includes(qLower) || qLower.includes(item.target_skill.toLowerCase());
      const catMatch = item.category.toLowerCase().includes(qLower);
      const textMatch = item.question.toLowerCase().includes(qLower);
      return skillMatch || catMatch || textMatch;
    });

    const item = matched || SYNTHETIC_INTERVIEW_CORPUS[0];
    if (!item) return null;

    let localizedQuestion = item.question;
    if (language === 'Taglish' && item.question_taglish) localizedQuestion = item.question_taglish;
    else if (language === 'Tagalog' && item.question_tagalog) localizedQuestion = item.question_tagalog;

    return {
      ...item,
      question: localizedQuestion
    };
  }

  /**
   * Evaluates candidate answer with full Conversational Loop-Around coaching
   * If candidate response misses key concepts or scores < 85, a loop-around follow-up drill is generated
   * in their detected language (Tagalog / Taglish / English) so the candidate can answer again and achieve mastery.
   *
   * @param {Object} questionObj - Question data
   * @param {string} userAnswer - Candidate response text
   * @param {Object} options - { round: number, previousAnswers: string[], preferredLanguage: string }
   * @returns {Object} Evaluation report with score, grade, loop_around status, follow-up prompt, and exemplar
   */
  function evaluateWithLoopAround(questionObj = {}, userAnswer = '', options = {}) {
    const round = Number(options.round) || 1;
    const baseEval = evaluateInterviewAnswer(questionObj, userAnswer, options);
    const lang = baseEval.language_detected || 'English';

    // Locate synthetic question entry if available
    const synthEntry = SYNTHETIC_INTERVIEW_CORPUS.find(s => s.id === questionObj.id || s.target_skill === questionObj.target_skill);

    let loopAroundPrompt = '';
    if (synthEntry && synthEntry.loop_around_prompts) {
      if (lang === 'Taglish') loopAroundPrompt = synthEntry.loop_around_prompts.taglish;
      else if (lang === 'Tagalog') loopAroundPrompt = synthEntry.loop_around_prompts.tagalog;
      else loopAroundPrompt = synthEntry.loop_around_prompts.english;
    }

    if (!loopAroundPrompt) {
      const missingHint = baseEval.missingPoints && baseEval.missingPoints.length > 0
        ? baseEval.missingPoints.slice(0, 2).join(' at ')
        : 'production trade-offs';

      if (lang === 'Taglish') {
        loopAroundPrompt = `Loop-Around Challenge: Maganda ang simula mo! Pero paano mo naman maipapaliwanag nang mas detalyado ang ${missingHint}? Subukan mong sagutin ulit sa ibaba para ma-perfect ang score mo.`;
      } else if (lang === 'Tagalog') {
        loopAroundPrompt = `Pag-ikot ng Pagsasanay: Mahusay ang iyong paunang tugon. Upang higit na mapatatag ang iyong sagot, paano mo ipaliliwanag ang ${missingHint}?`;
      } else {
        loopAroundPrompt = `Loop-Around Challenge: Promising start! How would you specifically dive deeper into ${missingHint} with concrete production trade-offs and latency metrics? Try answering again below.`;
      }
    }

    // Determine loop state
    const needsLoop = baseEval.score < 85;
    const isLoopCompleted = round > 1 && baseEval.score >= 70;

    let coachingTip = '';
    if (lang === 'Taglish') {
      coachingTip = isLoopCompleted
        ? 'Napakagaling! Matagumpay mong nasagot ang loop-around follow-up with concrete technical ownership.'
        : 'Gamitin ang STAR method: Situation, Task, Action, Result. Lagyan ng concrete numbers (% latency, req/sec).';
    } else if (lang === 'Tagalog') {
      coachingTip = isLoopCompleted
        ? 'Natatangi! Matagumpay mong naisara ang pagsasanay kalakip ang malinaw na datos ng tagumpay.'
        : 'Tiyaking may malinaw na sukatan at teknikal na pagpapasya sa bawat hakbang.';
    } else {
      coachingTip = isLoopCompleted
        ? 'Outstanding! You successfully navigated the loop-around drill with strong architectural depth.'
        : 'Ensure your response quantifies the business or engineering impact (e.g. latency drop %, uptime, concurrency).';
    }

    // Adjust score if this is a successful loop turn
    let finalScore = baseEval.score;
    if (round > 1) {
      finalScore = Math.min(100, Math.round(baseEval.score * 1.15));
    }

    return {
      ...baseEval,
      score: finalScore,
      round,
      loop_around: {
        is_loop_active: needsLoop && !isLoopCompleted,
        loop_completed: isLoopCompleted,
        round,
        missing_concepts: baseEval.missingPoints,
        followup_question: loopAroundPrompt,
        coaching_tip: coachingTip
      }
    };
  }

  return {
    IMPACT_KEYWORDS,
    TAGALOG_IMPACT_KEYWORDS,
    TAGALOG_PARTICLES,
    SYNTHETIC_INTERVIEW_CORPUS,
    detectAnswerLanguage,
    generateModelAnswer,
    evaluateInterviewAnswer,
    createCustomInterviewQuestion,
    findSyntheticQuestion,
    evaluateWithLoopAround
  };
});
