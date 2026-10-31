# SkillSync API Reference

All backend API endpoints require standard Bearer token authorization:
`Authorization: Bearer <SUPABASE_JWT_OR_DEMO_TOKEN>`

---

## 1. POST `/api.php`
Evaluates a candidate resume against a target job description and returns an objective ATS match percentage score and missing skill gaps.

### Request Headers
- `Content-Type: application/json`
- `Authorization: Bearer <TOKEN>`

### Request Body
```json
{
  "resume": "Experienced Full Stack Engineer with 5 years in React, Node.js...",
  "job_description": "We are seeking a Senior Full Stack Engineer proficient in TypeScript..."
}
```

### Response `200 OK`
```json
{
  "match_score": 88,
  "missing_skills": ["Docker", "Kubernetes", "GraphQL"]
}
```

---

## 2. POST `/ocr.php`
Transcribes an image of a resume (PNG, JPG, WEBP) or a screenshot pasted from the clipboard into plain text using Gemini 1.5 Flash Vision.

### Request Body
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Response `200 OK`
```json
{
  "success": true,
  "text": "Jane Doe\nFull Stack Developer\nExperience: ...",
  "char_count": 1420,
  "truncated": false
}
```

---

## 3. POST `/scrape.php`
Scrapes external job URLs (LinkedIn, Indeed, Greenhouse, Lever), strips HTML markup, extracts requirements via Gemini AI, and caches results in Supabase.

### Request Body
```json
{
  "url": "https://boards.greenhouse.io/company/jobs/12345"
}
```

### Response `200 OK`
```json
{
  "success": true,
  "cleaned_text": "Required qualifications: 4+ years React, TypeScript...",
  "cached": true
}
```
