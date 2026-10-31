# SkillSync Security & Hardening Audit

## Security Implementations

### 1. SSRF (Server-Side Request Forgery) Defense
The web scraper in `scrape.php` and `bootstrap.php` strictly validates external URLs before initiating any cURL request:
- Schemes are restricted to `http` and `https`.
- Private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`) and IPv6 loopback (`::1`) are resolved via DNS and rejected.
- Cloud metadata service IP addresses (`169.254.169.254`) are explicitly blocked.

### 2. Sliding Window Rate Limiting
- Prevents resource exhaustion and Gemini API quota drains.
- Per-user rate limiting implemented via atomic file-locking (`flock(LOCK_EX)`) in `/tmp/skillsync_limits/`.
- Default: 5 analysis requests per minute; returns HTTP `429 Too Many Requests` with a client warning toast.

### 3. Production Error Suppression
- `display_errors` is forced to `0`.
- All fatal and uncaught errors are piped into `secure_php_errors.log` outside web-accessible roots.
- Responses return sanitized JSON error messages avoiding stack trace leakage.

### 4. Row Level Security (RLS)
- Every scan record stored in PostgreSQL is tied to the caller's JWT `user_id`.
- Users cannot read, modify, or delete another candidate's history.
