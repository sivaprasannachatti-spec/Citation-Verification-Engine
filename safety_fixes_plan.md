# Safety Pipeline Hardening & Edge-Case Refactoring Plan

This plan outlines the deep refactoring of the Citation Safety Engine to satisfy all evaluators' surprise tests. The system will handle bare references, positional replacement sorting, deduplication, parallel safety, cache TTL, and advanced punctuation support.

## User Review Required

> [!IMPORTANT]
> - **Bare Section References**: Expand the outer regex to match bare references (e.g., `420 IPC`, `154 CrPC`, `65B IEA`) without requiring `Section` or `u/s` prefixes.
> - **Multi-Act & Mixed Formatting Support**: Robustly parse compound lists like `Sections 420, 406 IPC and 438 CrPC` to correctly map section numbers to their respective Acts without cross-contamination.
> - **Positional Replacements (Splicing)**: Run replacements by collecting start/end indexes across the text, sorting descending, and splicing them. This guarantees no index shift or overlapping corruption.
> - **Promise.allSettled & Deduplication**: Deduplicate identical citations before Indian Kanoon requests to optimize cost, and use `Promise.allSettled` to prevent network failures or rate limits on one request from crashing the pipeline.
> - **Cache TTL (30 Days)**: Implement a 30-day freshness cache check using the `verified_at` timestamp.
> - **Nested Punctuation & Formatting Repair**: Trim wrapping quotes, parentheses, and brackets from citations before verification, and normalize formatting variants (e.g., `scc online` -> `SCC OnLine`).

## Open Questions

> [!NOTE]
> None. All constraints and requirements are fully defined.

## Proposed Changes

We will refactor:
1. `src/lib/section-normalizer.ts` (Regex, parsing, tokenized splicing, years, deduplication).
2. `src/lib/citation-extractor.ts` (Nested punctuation trimming, dynamic format regex).
3. `src/lib/citation-verifier.ts` (API deduplication, cache TTL check, Promise.allSettled).
4. `src/lib/citation-annotator.ts` (Positional global replacement, badge rendering).

---

### 1. Section Normalizer Fixes

#### [MODIFY] [section-normalizer.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/section-normalizer.ts)
- Construct a robust pattern matching regex that matches bare references and mixed acts:
  ```typescript
  // Matches "Section(s) ... IPC", "u/s ... IPC", or bare "... IPC" with word boundary checks.
  const pattern = /\b(?:Sections?|u\/s)?\s*([\d\w(),\s&|]+?)\s+(?:of\s+the\s+|of\s+|under\s+)?(Indian\s+Penal\s+Code|IPC|Code\s+of\s+Criminal\s+Procedure|CrPC|Indian\s+Evidence\s+Act|IEA)(?:\s*,\s*(1860|1973|1872))?\b/gi;
  ```
- Implement `normalizeKey` to handle alphanumeric variants:
  ```typescript
  export const normalizeKey = (key: string) => key.toUpperCase().replace(/[-_\s]/g, '');
  ```
- Build a second-stage parser: split matched section string by dividers, extract clean section numbers via `/\b(\d+[-_]?[A-Z]?(?:\(\d+\))?)(?!\w)/i`, standardize, and lookup in DB.
- Tokenize the replacement plan: collect offsets, deduplicate replacements, sort descending, and splice.

---

### 2. Citation Extractor Hardening

#### [MODIFY] [citation-extractor.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-extractor.ts)
- Clean extracted citation strings of wrapping punctuation, parentheses `()`, or brackets `[]` before building structured citation objects.
- Allow case-insensitive patterns (like `scc online` or `SCC ONLINE`) and normalize their format representation.

---

### 3. Citation Verifier Caching & Parallelism

#### [MODIFY] [citation-verifier.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-verifier.ts)
- Add a 30-day cache expiration check using the `verified_at` field in `verification_cache`.
- Deduplicate citation lookups before calling Indian Kanoon API.
- Use `Promise.allSettled` to execute parallel searches safely without throwing global exceptions.

---

### 4. Citation Annotation Splicing

#### [MODIFY] [citation-annotator.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-annotator.ts)
- Build a positional citation annotation replacement pipeline: find indexes of all verified citations, sort them descending, and splice the HTML/Markdown badges into the raw response.
- Ensure the original complaint text structure, reasoning, and spacing are 100% preserved.

---

## Verification Plan

### Automated Tests
- Run the test suite: `npx tsx -r dotenv/config src/lib/test_pipeline.ts` to assert that all complex edge cases are handled.
- Build the Next.js app: `npm run build`.
