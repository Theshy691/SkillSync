# SkillSync Project Directory Structure

A clean, modular architecture separating frontend client views, backend services, database migrations, tests, and documentation.

```
SkillSync/
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated GitHub Actions test pipeline
├── assets/
│   ├── css/
│   │   └── landing-page.css     # Design system, tokens, and responsive styles
│   └── js/
│       ├── landing-page.js      # Marketing page interactions & hero simulator
│       └── modules/             # Modular ES6 feature utilities
│           ├── export.js        # PDF generation & clipboard export
│           ├── ocr.js           # Image upload & AI OCR client
│           ├── pdf.js           # Client-side PDF.js extractor
│           ├── scraper.js       # External job scraper client
│           ├── theme.js         # Dark/light theme controller
│           └── toast.js         # Accessible toast notification system
├── backend/                     # Core PHP 8.2 backend service layer
│   ├── api.php                  # ATS resume evaluation proxy (Gemini 1.5 Flash)
│   ├── bootstrap.php            # Security headers, auth verification, and rate limiter
│   ├── ocr.php                  # Multimodal vision OCR endpoint
│   └── scrape.php               # SSRF-protected job posting web scraper
├── database/                    # Database schemas and seed data
│   ├── schema.sql               # PostgreSQL tables, indexes, and RLS policies
│   └── seed.sql                 # Sample test records for local database development
├── docs/                        # Complete technical documentation suite
│   ├── API_REFERENCE.md         # Endpoints, payloads, and response schemas
│   ├── ARCHITECTURE.md          # System topology & mermaid architecture flow
│   ├── DATABASE_SCHEMA.md       # Tables, columns, constraints, and RLS rules
│   ├── DEPLOYMENT_GUIDE.md      # Docker and production server runbook
│   ├── DIRECTORY_STRUCTURE.md   # This maintenance guide
│   └── SECURITY_AUDIT.md        # SSRF defense, rate limiting, and error handling
├── examples/                    # Sample resume & job posting fixtures
│   ├── sample_job_posting.txt
│   ├── sample_resume_frontend.txt
│   └── sample_resume_swe.txt
├── storage/                     # Ephemeral runtime cache & rate limit storage
│   └── ratelimit/               # File-locked per-user sliding window limit records
├── tests/                       # Automated Jest unit test suite
│   ├── script.test.js           # End-to-end frontend controller tests
│   ├── theme.test.js            # Theme controller unit tests
│   └── toast.test.js            # Toast notification dispatch tests
├── app.html                     # Dedicated ATS application workspace console
├── index.html                   # Marketing & product overview landing page
├── config.js                    # Client-side Supabase credentials & configuration
├── script.js                    # Main ATS application controller
├── api.php                      # Root forwarder -> backend/api.php
├── bootstrap.php                # Root forwarder -> backend/bootstrap.php
├── ocr.php                      # Root forwarder -> backend/ocr.php
├── scrape.php                   # Root forwarder -> backend/scrape.php
├── schema.sql                   # Root pointer -> database/schema.sql
├── Dockerfile                   # Container definition with PHP 8.2 & Apache
├── docker-compose.yml           # Multi-container orchestration definition
├── package.json                 # Node.js dependencies, scripts, and metadata
└── README.md                    # Project overview and quickstart instructions
```

## Maintenance Guidelines
- **Adding an API endpoint**: Implement logic in `backend/<endpoint>.php` and create a root proxy file if direct root access is needed.
- **Frontend Utilities**: Add new reusable helper functions to `assets/js/modules/`.
- **Database Migrations**: Add schema revisions to `database/schema.sql`.
- **Testing**: Add corresponding test files in `tests/<module>.test.js` and execute `npm test`.
