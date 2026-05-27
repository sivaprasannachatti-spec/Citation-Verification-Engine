# BRAHMO Citation Safety Engine — Production Hardening & Upgrade Plan

This document details the production-grade architectural changes and hardening steps designed to make the safety engine fully dynamic, robust against adversarial live tests, and compliant with all assessment specifications.

---

## User Review Required

> [!IMPORTANT]
> - **Indian Kanoon POST Transition**: The proxy endpoint `/api/indian-kanoon` will be updated to fetch from Indian Kanoon's `/search/` using the mandatory `POST` request method with serialized JSON bodies and headers.
> - **Dynamic Capture-Group Parsing**: We will eliminate hardcoded parsing rules for the 6 citation formats. Group indices (`year_group`, `volume_group`, `page_group`, `court_group`) will be retrieved from the database to enable code-change-free additions of new formats.
> - **Precise Semantic Classification**: Citations that do not exist on Indian Kanoon will not be aggressively flagged as `REMOVED` (fabricated) unless they fail pre-filter checks, or are for major reporters (SCC/SCR/AIR) where a successful API query returns zero results. Obscure or timeout-impacted queries will fall back to `UNVERIFIED`.
> - **Schema-Aware Caching**: A `CACHE_VERSION` constraint is introduced. Cache reads will handle missing columns gracefully, invalidate version mismatches, and log detailed reasoning in `cache_metadata`.
> - **Enterprise Observability**: A detailed step-by-stage pipeline timing trace, cache efficiency telemetry, and pre-filter cost savings metric will be exposed in the UI.

---

## Added Production-Hardening & Adversarial Protections (New)

### 1. Unknown Format Handling (Heuristic Fallback)
- **Heuristic Pattern Detector**: Implement a fallback parser after regex-based extraction to detect citation-like sequences that do not match the 6 registered regexes. The heuristic targets patterns such as:
  - `(Year) Volume REPORTER Page` (e.g. `(2022) 5 SCALE 123`)
  - `Year REPORTER (Court) Page` (e.g. `2023 LiveLaw (SC) 456`)
  - `Year INSC Page` (Neutral Citations, e.g. `2024 INSC 233`)
- **Unknown Citation Class**: Classify these as `UNVERIFIED` with the status message `UNKNOWN_FORMAT` and reasoning: "Detected unknown format; obscure or newer citation reporter may be valid but is not actively registered."

### 2. False Positive Proximity Filter
- **Legal Context Validation**: Prevent aggressive regex extraction from picking up invoice codes (`Invoice 2024 SCC 12345`) or product model numbers (`AIR Conditioner 2024 SC 300`).
- **Keyword Proximity Analysis**: Inspect a 100-character window surrounding each citation. Compute a score based on legal keywords (`v.`, `vs.`, `appeal`, `petition`, `judgment`, `court`, `accused`, `bail`, `precedent`). Suppress matches that lack legal context or contain strong non-legal indicators (`invoice`, `billing`, `model`, `serial`, `ref`).

### 3. Cross-Citation Relationship & Overruling Warning
- **Overruling Database**: Load a static lookup list of overruled/weakened Supreme Court precedents.
  - *Example*: `(2017) 9 SCC 1` (Rajesh Sharma) was modified/overruled by `(2018) 10 SCC 443` (Social Action Forum).
  - *Example*: `(2014) 1 SCC 1` (Suresh Koushal) was overruled by `(2018) 10 SCC 1` (Navtej Johar).
- **Lightweight Relationship Warnings**: If a cited case is overruled, append a warning: `⚠️ Citation Relationship Warning: Case [Citation] is overruled or modified by [Overruling Case]`.

### 4. Citation Canonicalization Stability
- **`canonicalizeCitation(text, pattern)`**: Create a standard normalization function. Clean punctuation, standardize whitespace (single space), normalize casing, strip dot delimiters (`S.C.C.` -> `SCC`), and sanitize OCR brackets.
- Apply this canonicalization *before* deduplication, cache checks, verification queries, and aggregation.

### 5. Large Input & Regex Safety
- **Size Caps & Chunking**: Cap input length at 200,000 characters. For texts exceeding the limit, chunk processing into paragraph blocks to avoid memory spikes and thread blocking.
- **Catastrophic Backtracking Prevention**: Rewrite and verify all extraction regexes to guarantee linear-time evaluation (`O(n)`) by removing nested quantifiers and overlapping character classes.
- **Extraction Timeout**: Wrap extraction loops in a timeout guard (`AbortController` or timing check) set to 5 seconds.

### 6. Prompt Injection & Output Sanitization
- **Badge Spoofing Prevention**: Strip or escape any user-generated badge syntax (e.g. `[✅ VERIFIED - ...]`) from the raw LLM output before the annotator parses it.
- **HTML Escaping**: Escape HTML tags (`<`, `>`) to prevent injection vulnerabilities.
- **Immutable AST Rendering**: Construct a position-aware AST-style segment array (`segments`) representing sections of text and verification nodes to bypass unsafe text-replacement in React.

### 7. Graceful Degradation Modes
- **Pipeline States**: Support states `LIVE_VERIFIED`, `CACHE_VERIFIED`, `DEGRADED_MODE` (offline or API key missing/rate-limited with cache miss), and `OFFLINE_MODE`.
- **UI Degradation Notice**: Display status banners indicating operational degradation instead of displaying generic errors.

### 8. Metrics Integrity Check
- **Invariant Validation**: Enforce `verified + corrected + removed + unverified === total`. Raise warnings and reconcile discrepancy anomalies programmatically to preserve consistency.

---

## Proposed Changes

We will refactor the core engine and update the frontend UI. The files are organized by component layers.

---

### Component 1: Citation Extraction & Preprocessing

#### [MODIFY] [citation-extractor.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-extractor.ts)
- **OCR and Whitespace Preprocessing**: Implement `normalizeCitationInput(text)` to normalize Unicode spaces (e.g. `\u00A0`), convert tabs, collapse multiple spaces, and sanitize OCR artifacts.
- **Database-Driven Parsing**: Refactor `parseCitation` to dynamically read group indices (`year_group`, `volume_group`, `page_group`, `court_group`) from database patterns.
- **Dynamic Canonical Builder**: Replace the hardcoded `switch` in `buildCanonical` with string substitution based on `format_template`.
- **Heuristic Fallback Layer**: Implement fallback scanning to detect unknown format candidates and flag them as `UNKNOWN_FORMAT`.
- **False Positive Filter**: Run proximity keyword scanning to filter out product codes and invoice numbers.
- **Deduplication**: Deduplicate extracted citations using `canonicalizeCitation`.

---

### Component 2: Hallucination Pre-Filtering

#### [MODIFY] [hallucination-detector.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/hallucination-detector.ts)
- **Dynamic Year Threshold**: Implement `getCurrentLegalYear()` using `new Date().getFullYear()`. Use this utility dynamically in all checks.

---

### Component 3: Section Act Normalization

#### [MODIFY] [section-normalizer.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/section-normalizer.ts)
- **Dynamic Act Matcher**: Build the enactment search regex dynamically based on unique `old_act` values loaded from `section_mappings`.
- **Dynamic Abbreviation Resolvers**: Derive abbreviation alias maps (`actAlias` and `newActAbbr`) dynamically from database rows at startup.

---

### Component 4: Citation Verification & Caching

#### [MODIFY] [citation-verifier.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-verifier.ts)
- **IK POST Search**: Update the search fetch request to target `https://api.indiankanoon.org/search/` using the `POST` method with `"Content-Type": "application/json"` headers and JSON body containing `formInput`.
- **Bounded Parallelism and Retries**: Implement a bounded queue (limit 5 concurrent requests) and an exponential backoff retry mechanism (up to 2 retries).
- **Semantic Classification Rules**:
  - `VERIFIED`: Found on IK and matches.
  - `CORRECTED`: Found on IK with different page; returns corrected text.
  - `UNVERIFIED`: Format valid, pre-filters pass, but API calls timeout, fail, or target obscure formats (e.g., `MANU` or other unrecognized formats) not found on IK.
  - `REMOVED`: Pre-filter errors (future year, impossible volume) OR major reporter formats (SCC, SCR, AIR, Cri_LJ, SCC_OnLine) successfully queried but returning no matches.
- **Reasoning Logger**: Populate a `reasoning` field describing the decision for every classification.
- **Overruled Analysis**: Check if the citation matches the overruled database list and append a warning.
- **Schema-Aware Cache**: Implement `CACHE_VERSION` validation. Gracefully catch cases where the column is missing in legacy databases, invalidate mismatching versions, and log reasoning in `cache_metadata`.
- **Operating Modes**: Propagate pipeline operating mode (`LIVE_VERIFIED`, `CACHE_VERIFIED`, `DEGRADED_MODE`).

---

### Component 5: Proxy API Routing

#### [MODIFY] [api/indian-kanoon/route.ts](file:///c:/AI%2520Verification%2520Engine/src/app/api/indian-kanoon/route.ts)
- Refactor the proxy endpoint to accept both `GET` and `POST` requests, parsing `formInput` from query or body.
- Make the upstream fetch to Indian Kanoon using the correct `POST` request format and timeout handling.

---

### Component 6: Test Isolation

#### [NEW] [tests/](file:///c:/AI%2520Verification%2520Engine/tests)
- Create a root `/tests` directory and move `test_pipeline.ts` and `test_verification_live.ts` into it.
- **Adversarial Test Suite**: Add `tests/adversarial_suite.ts` to test edge-cases (OCR corruption, rare citations, malformed spacing, large inputs, prompt injections, false positive suppression).
- Update imports in scripts to reference the new paths.

#### [DELETE] [test_pipeline.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/test_pipeline.ts)
#### [DELETE] [test_verification_live.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/test_verification_live.ts)

---

### Component 7: Observability & Frontend UI

#### [MODIFY] [citation-annotator.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-annotator.ts)
- **Sanitization**: Escape HTML tags and strip LLM-injected badge syntax before processing.
- **AST-Segment Generation**: Build a position-aware segment array (`segments`) mapping text ranges and verification nodes to avoid index shifting.
- **Metrics Integrity Reconciliation**: Programmatically validate `verified + corrected + unverified + removed === total`.
- Update `annotateTextAndReport` to compile pipeline latency, cache hits/misses, and pre-filter cost savings.

#### [MODIFY] [ResponseComparison.tsx](file:///c:/AI%2520Verification%2520Engine/src/components/ResponseComparison.tsx)
- **AST-Segment Rendering**: Read and render the AST segments directly as React nodes, bypassing string replacement parsing.

#### [MODIFY] [VerificationReport.tsx](file:///c:/AI%2520Verification%2520Engine/src/components/VerificationReport.tsx)
- Display pre-filter cost savings, cache hit telemetry, verification latency, and metrics validation warning banners.

#### [MODIFY] [CitationAlerts.tsx](file:///c:/AI%2520Verification%2520Engine/src/components/CitationAlerts.tsx)
- Highlight dangerous (REMOVED) alerts first, and group warnings and unverified items separately to reduce alert fatigue. Show reasoning and overruling warnings for each.

---

### Component 8: Database & Migration Schema

#### [MODIFY] [schema.sql](file:///c:/AI%2520Verification%2520Engine/supabase/schema.sql)
- Update table schema for `verification_cache` to include `cache_version INT DEFAULT 1` and `cache_metadata JSONB DEFAULT '{}'::jsonb`.
- Update `citation_patterns` columns to include extraction groups.

---

## Verification Plan

### Automated Tests
1. **Adversarial Tests**: Run `npx tsx tests/adversarial_suite.ts` to verify extreme spacing, OCR corruption, prompt injections, and false positive suppression.
2. **Offline Tests**: Run `npx tsx tests/test_pipeline.ts` to verify extraction and annotation.
3. **Live Tests**: Run `npx tsx tests/test_verification_live.ts` to test live Indian Kanoon interactions.
4. **Compile and Build**: Run `npm run build` to ensure production bundle does not contain test code and passes Type-checks.

### Manual Verification
- Test all 4 demo scenarios on the UI and check the dynamic metrics inside the reports panel.
