# Brahmo Citation Safety Engine — Legal AI Guardrail

Brahmo is a production-grade citation and section safety guardrail designed for Indian Legal AI systems. It intercepts AI-generated legal drafts and applies a **100% deterministic, rule-based verification pipeline** (no AI logic inside the safety layer) to ensure case precedents exist, page numbers are corrected, hallucinations are deleted, and outdated legal sections (IPC/CrPC/IEA) are mapped to modern counterparts (BNS/BNSS/BSA).

---

## 🛠️ Tech Stack & Architecture

- **Frontend & Server-Side Backend**: Next.js 16 + TypeScript + Tailwind CSS v4 (Single Next.js project layout)
- **Database**: Supabase (PostgreSQL) for citation pattern regexes, section conversion mappings, and verification caches
- **Precedent Verification**: Indian Kanoon Search API
- **AI Response Generation**: Google Gemini (Primary API) with Groq (Secondary API fallback)
- **Development Tools**: Node.js, `tsx` (for CLI testing)

---

## 📂 Project Structure

Following the exact architectural specification:

```
brahmo-citation-safety/
├── README.md
├── .env.local                    ← Database & API keys (DO NOT commit)
├── .env.local.example            ← Env variable template
├── package.json                  ← Root package manager
├── tailwind.config.ts / postcss  ← CSS configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx            ← Global metadata & fonts
│   │   ├── page.tsx              ← Main dashboard front-end UI
│   │   └── api/
│   │       ├── llm/route.ts      ← LLM key rotation & pipeline orchestrator
│   │       ├── citation-check/   ← Standalone citation check endpoint
│   │       ├── normalize-sections/← Standalone BNS section normalizer
│   │       └── indian-kanoon/    ← Indian Kanoon proxy server-route
│   ├── lib/
│   │   ├── types.ts              ← Shared TS interfaces
│   │   ├── supabase.ts           ← Supabase database client
│   │   ├── citation-extractor.ts  ← DB-driven regex citation scanner
│   │   ├── hallucination-detector.ts ← Deterministic 4-rule hallucination checker
│   │   ├── citation-verifier.ts   ← Parallel Indian Kanoon verifier & cache
│   │   ├── section-normalizer.ts  ← Legacy section to BNS/BNSS/BSA parser
│   │   ├── citation-annotator.ts  ← Badging and citation report compiler
│   │   ├── matters.ts            ← 8 preloaded legal matters seed data
│   │   └── test_pipeline.ts      ← Dynamic automated pipeline test suite
│   └── components/
│       ├── MatterCard.tsx        ← Selection cards for matters
│       ├── ResponseComparison.tsx← Side-by-side Generic vs Enhanced responses
│       ├── CitationAlerts.tsx    ← Warning lists for rule violations
│       └── VerificationReport.tsx← Precision gauge & cost logger
└── supabase/
    ├── schema.sql                ← PostgreSQL tables and indexes
    └── seed.sql                  ← 6 Regex patterns & 30 Section mappings
```

---

## 🚀 Setup & Installation

### 1. Database Configuration (Supabase)
Create a new Supabase project. Go to the **SQL Editor** in your Supabase dashboard, and run the contents of:
1. `supabase/schema.sql` (Creates `citation_patterns`, `section_mappings`, and `verification_cache` tables and indexes).
2. `supabase/seed.sql` (Seeds 6 regex patterns and 30 IPC → BNS section conversion rules).

### 2. Environment Setup
Rename `.env.local.example` to `.env.local` at the root and fill in your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

INDIAN_KANOON_API_KEY=your-indian-kanoon-token

# Comma-separated API keys for rotation/fallback (no spaces)
GEMINI_API_KEY=key_1,key_2
GROQ_API_KEY=key_1,key_2
```

### 3. Install Dependencies
Run the following command at the root to install all required packages:
```bash
npm install
```

---

## 🧪 Running Automated Tests

A dedicated test suite `src/lib/test_pipeline.ts` is provided to verify the core safety logic without running the server. It tests:
1. **Extraction**: Parsing of all 6 formats (SCC, SCC OnLine, AIR, Cri LJ, SCR, MANU).
2. **Hallucination Detection**: Triggering of all 4 pre-filter rules.
3. **Section Normalization**: IPC → BNS mapping (including list parsing e.g. "Sections 420 and 34 IPC").
4. **Annotation**: Rendering of inline safety badges and compiling accuracy percentages.

Execute the test suite locally:
```bash
# Windows (PowerShell)
Get-Content .env.local | ForEach-Object { if ($_ -match '^(.*?)=(.*)$') { [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim()) } }; npx tsx src/lib/test_pipeline.ts

# Linux / macOS
env $(cat .env.local | xargs) npx tsx src/lib/test_pipeline.ts
```

---

## 💻 Running the App

Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the interactive dashboard.

---

## 🛡️ The Deterministic Verification Pipeline

1. **Lawyer Query Input**: The lawyer selects a matter or inputs a custom legal question.
2. **Generic AI Response**: The system requests a draft from the LLM (Gemini with Groq fallback). The LLM is **only** used for generation.
3. **Citation Extractor**: Scans response text using regex patterns loaded from Supabase to find citations.
4. **Hallucination Detector**: Evaluates each citation against 4 rules:
   - **Future Year**: Year > 2026 (Marked as `NOT_FOUND` / `ERROR`, skips API call).
   - **Impossible Volume**: SCC volume > 25 (Marked as `NOT_FOUND` / `ERROR`, skips API call).
   - **Abnormal Page**: Page > 5000 (Flags `WARNING` but proceeds to verification).
   - **Pre-Modern Date**: Year < 1900 (Flags `WARNING` but proceeds to verification).
5. **Citation Verifier**: Checks the cached database. For uncached, non-hallucinated citations, executes **parallel async requests** to Indian Kanoon to confirm validity. If verified with different page numbers, flags it as `CORRECTED`.
6. **Section Normalizer**: Scans the text for old statutory references (IPC/CrPC/IEA) and updates them to BNS/BNSS/BSA.
7. **Citation Annotator**: Inserts rich safety badges inline (e.g. `[✅ VERIFIED]`, `[⚠️ CORRECTED]`, `[❌ REMOVED]`) and builds a detailed report card.
