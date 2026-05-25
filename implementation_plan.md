# Safety Pipeline Fixes: Section Normalization & Citation Annotation Plan

This plan details the deep refactoring of the Brahmo Citation Safety Engine's deterministic verification pipeline. It implements tokenized normalization, key standardization, enactment year corrections, positional replacement to avoid overlapping corruption, and strict separation between the AI generation layer and the deterministic safety engine.

## User Review Required

> [!IMPORTANT]
> - **Tokenized Normalization Pipeline**: Instead of naive regex string replacements, we will parse the text into structured tokens, map them, resolve index offsets, and replace them in a single deterministic pass to prevent overlapping or corrupted replacements.
> - **Advanced Outer Regex & Multi-Section Splitter**: We will support prefixes like `u/s`, `Section`, `Sections` (case-insensitive), hyphens, spaces, and complex lists (e.g. `Sections 420, 406, 120B and 34 IPC`).
> - **Act Year Correction / Stripping**: Obsolete years (e.g., `1860`, `1973`, `1872`) will be dynamically detected and stripped from the normalized output.
> - **Positional Citation Annotation**: Citations will be sorted longest-first or replaced using index-based slicing to prevent overlapping string corruptions.
> - **Deduplication**: Mappings shown to the user will be strictly deduplicated in the backend to ensure a clean visual dashboard.

## Open Questions

> [!NOTE]
> None. The architecture and requirements are fully specified.

## Proposed Changes

We will refactor `src/lib/section-normalizer.ts` and `src/lib/citation-annotator.ts`.

---

### Section Normalization Pipeline

#### [MODIFY] [section-normalizer.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/section-normalizer.ts)
- Implement `normalizeKey` to handle uppercase formatting and strip separators:
  ```typescript
  export const normalizeKey = (key: string) => key.toUpperCase().replace(/[-_\s]/g, '');
  ```
- Build an outer pattern regex to capture complex section references and optional enactment years:
  ```typescript
  const pattern = /\b(?:Sections?|u\/s)\s+([\d\w(),\s&|]+?)\s+(?:of\s+the\s+|of\s+|under\s+)?(Indian\s+Penal\s+Code|IPC|Code\s+of\s+Criminal\s+Procedure|CrPC|Indian\s+Evidence\s+Act|IEA)(?:\s*,\s*(1860|1973|1872))?\b/gi;
  ```
- Parse the matched section lists dynamically (split by commas, `and`, `&`, `or`) and resolve their corresponding BNS/BNSS/BSA codes.
- Implement a tokenized replacement pipeline: find matches, construct positional replacement metadata, sort by start index descending, and apply them cleanly to avoid offset shifts.
- Deduplicate replacements based on unique mapping rules.

---

### Citation Annotation Pipeline

#### [MODIFY] [citation-annotator.ts](file:///c:/AI%2520Verification%2520Engine/src/lib/citation-annotator.ts)
- Refactor `annotateTextAndReport` to perform a global search and replace for each citation.
- Prevent overlapping citation matches by replacing longest citations first.
- Ensure the original formatting, paragraphs, and structure of the complaint are completely preserved.

---

## Verification Plan

### Automated Tests
- Run `npx tsx -r dotenv/config src/lib/test_pipeline.ts` to verify the pipeline behavior locally.
- Build the app with `npm run build` to confirm TypeScript type-safety.
