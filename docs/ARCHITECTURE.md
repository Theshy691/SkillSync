# SkillSync Technical Architecture

## Overview
SkillSync is an AI-powered resume and job description match analyzer that replicates enterprise Applicant Tracking System (ATS) parsing algorithms.

```mermaid
flowchart TD
    User([User / Browser])
    
    subgraph Frontend [Client Layer]
        App[Single Page Console]
        PDFParser[PDF.js In-Browser Parser]
        PasteHandler[Clipboard Paste Interceptor]
        TesseractOCR[Tesseract.js Local OCR]
        ThemeEngine[Theme Sync Controller]
    end

    subgraph Backend [PHP 8.2 Security & Proxy Engine]
        Bootstrap[bootstrap.php: Auth & Rate Limiter]
        API[api.php: ATS Match Proxy]
        Scraper[scrape.php: Web Scraper & Cleaner]
        OCR[ocr.php: Multimodal Vision OCR]
    end

    subgraph CloudServices [External Cloud & DB]
        SupabaseAuth[Supabase Auth Engine]
        SupabaseDB[(PostgreSQL RLS Database)]
        Gemini[Google Gemini 1.5 Flash API]
        YouTube[YouTube Search API]
    end

    User --> App
    App --> PDFParser
    App --> PasteHandler
    PasteHandler --> OCR
    PasteHandler -. Fallback .-> TesseractOCR
    App --> ThemeEngine

    App -->|Bearer JWT| Bootstrap
    Bootstrap --> API
    Bootstrap --> Scraper
    Bootstrap --> OCR

    Bootstrap -->|Verify Session| SupabaseAuth
    API -->|Prompt & Schema| Gemini
    OCR -->|Vision InlineData| Gemini
    Scraper -->|Query & Save| SupabaseDB
    App -->|Read / Write Scans| SupabaseDB
    App -->|Learning Chips| YouTube
```

## Core Components
1. **Frontend**: Static HTML5/JavaScript application with Tailwind CSS, DM Sans & Fraunces typography, and glassmorphic micro-interactions.
2. **Document Processing**: Client-side PDF parsing via `PDF.js` and multimodal image transcription via `ocr.php` and `Gemini 1.5 Flash`.
3. **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) guaranteeing user data isolation.
4. **Proxy Layer**: PHP 8.2 FastCGI with SSRF protection, Bearer token verification, file-locked sliding window rate limiting (5 req/min), and secure error suppression.
