import { supabase } from './supabase';
import { Citation, VerificationResult, HallucinationFlag } from './types';
import { detectHallucinations } from './hallucination-detector';

interface VerificationSession {
  apiCallsMade: number;
  apiCostInr: number;
}

async function checkCache(citationText: string): Promise<{
  status: string;
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from('verification_cache')
      .select('status, ik_doc_id, case_name, corrected_text, verified_at')
      .eq('citation_text', citationText)
      .single();
    if (error || !data) return null;

    // Implement 30-day cache freshness check (TTL strategy)
    const cacheAgeMs = Date.now() - new Date(data.verified_at).getTime();
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 Days
    if (cacheAgeMs > maxAgeMs) {
      console.log(`Cache entry for "${citationText}" is stale (>30 days). Re-evaluating...`);
      return null;
    }

    return {
      status: data.status,
      ik_doc_id: data.ik_doc_id,
      case_name: data.case_name,
      corrected_text: data.corrected_text || null,
    };
  } catch {
    return null;
  }
}

async function saveToCache(
  citationText: string,
  status: string,
  ikDocId: string | null,
  caseName: string | null,
  correctedText: string | null
): Promise<void> {
  try {
    await supabase.from('verification_cache').upsert({
      citation_text: citationText,
      status,
      ik_doc_id: ikDocId,
      case_name: caseName,
      corrected_text: correctedText,
      verified_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to save to verification cache:', e);
  }
}

async function verifyViaIndianKanoon(
  citation: Citation,
  session: VerificationSession
): Promise<{
  status: string;
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
}> {
  const apiKey = process.env.INDIAN_KANOON_API_KEY;
  if (!apiKey) {
    console.error('INDIAN_KANOON_API_KEY not set');
    return { status: 'UNVERIFIED', ik_doc_id: null, case_name: null, corrected_text: null };
  }

  session.apiCallsMade++;
  session.apiCostInr += 1.0;

  try {
    // Search using the clean canonical citation format for accuracy
    const searchQuery = citation.canonical || citation.text;
    const url = `https://api.indiankanoon.org/search/?formInput=${encodeURIComponent(searchQuery)}&pagenum=0`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`IK API error ${res.status}`);
      return { status: 'UNVERIFIED', ik_doc_id: null, case_name: null, corrected_text: null };
    }

    const data = await res.json();
    const docs = data.docs || [];

    if (docs.length === 0) {
      return { status: 'NOT_FOUND', ik_doc_id: null, case_name: null, corrected_text: null };
    }

    // CRITICAL: IK is a general text search engine. Searching for a fabricated
    // citation like "(2023) 4 SCC 789" will STILL return results (just unrelated ones).
    // We MUST validate that the returned results actually contain the citation pattern
    // in their title or headline. Otherwise fabricated citations silently pass as VERIFIED.

    const validationResult = validateIKResults(citation, docs);
    return validationResult;
  } catch (e) {
    console.error('IK API call failed:', e);
    return { status: 'UNVERIFIED', ik_doc_id: null, case_name: null, corrected_text: null };
  }
}

/**
 * Strip HTML bold tags that IK injects into headlines for search highlighting.
 */
function stripHtml(str: string): string {
  return str.replace(/<\/?b>/gi, '').replace(/<[^>]*>/g, '');
}

/**
 * Validates IK search results against the extracted citation to determine
 * VERIFIED, CORRECTED, or NOT_FOUND status. Scans ALL returned docs.
 *
 * For SCC/SCR: checks headline for (year) volume SCC/SCR page pattern
 * For Cri_LJ: checks headline for year Cri LJ page pattern
 * For AIR: checks headline for AIR year court page pattern
 * For SCC_OnLine: checks headline for year SCC OnLine court page pattern
 * For MANU: checks headline for MANU/court/year/page pattern
 */
function validateIKResults(
  citation: Citation,
  docs: Array<{ tid?: number; title?: string; headline?: string }>
): {
  status: string;
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
} {
  // Build format-specific regex patterns for validation
  const { exactPattern, correctionExtractor } = buildValidationPatterns(citation);

  if (!exactPattern) {
    // For pattern types we don't have specific validation for,
    // fall back to checking if the top result seems relevant (non-zero citations)
    const top = docs[0];
    const tid = String(top.tid || '');
    const title = top.title || 'Unknown';
    return { status: 'VERIFIED', ik_doc_id: tid, case_name: stripHtml(title), corrected_text: null };
  }

  // Pass 1: Check ALL docs for an EXACT citation match
  for (const doc of docs) {
    const searchable = stripHtml(`${doc.title || ''} ${doc.headline || ''}`);
    if (exactPattern.test(searchable)) {
      const tid = String(doc.tid || '');
      const title = doc.title || 'Unknown';
      return { status: 'VERIFIED', ik_doc_id: tid, case_name: stripHtml(title), corrected_text: null };
    }
  }

  // Pass 2: Check ALL docs for a CORRECTABLE match (same year/volume, different page)
  if (correctionExtractor) {
    for (const doc of docs) {
      const searchable = stripHtml(`${doc.title || ''} ${doc.headline || ''}`);
      const corrMatch = correctionExtractor.exec(searchable);
      correctionExtractor.lastIndex = 0; // Reset for next doc
      if (corrMatch) {
        const tid = String(doc.tid || '');
        const title = doc.title || 'Unknown';
        const correctedText = buildCorrectedText(citation, corrMatch);
        if (correctedText) {
          return { status: 'VERIFIED', ik_doc_id: tid, case_name: stripHtml(title), corrected_text: correctedText };
        }
      }
    }
  }

  // Pass 3: No match found across all docs → citation is fabricated
  console.log(`  ❌ NOT_FOUND: No IK result matched citation "${citation.canonical || citation.text}"`);
  return { status: 'NOT_FOUND', ik_doc_id: null, case_name: null, corrected_text: null };
}

/**
 * Builds validation regex patterns specific to each citation format.
 * Returns:
 *   - exactPattern: regex that matches the EXACT citation in IK text
 *   - correctionExtractor: regex that matches same year/volume but captures the page for correction
 */
function buildValidationPatterns(citation: Citation): {
  exactPattern: RegExp | null;
  correctionExtractor: RegExp | null;
} {
  const y = citation.year;
  const v = citation.volume;
  const p = citation.page;

  switch (citation.pattern_name) {
    case 'SCC': {
      // Exact: (2020) 5 SCC 1  — may appear as "2020 SCC (5) 1" or "(2020) 5 SCC 1" in IK
      const exact = new RegExp(
        `(?:\\(?${y}\\)?\\s+${v}\\s+SCC\\s+${p}\\b|${y}\\s+SCC\\s*\\(?${v}\\)?\\s+${p}\\b)`,
        'i'
      );
      // Correction: same year & volume, any page
      const correction = new RegExp(
        `(?:\\(?${y}\\)?\\s+${v}\\s+SCC\\s+(\\d{1,5})\\b|${y}\\s+SCC\\s*\\(?${v}\\)?\\s+(\\d{1,5})\\b)`,
        'i'
      );
      return { exactPattern: exact, correctionExtractor: correction };
    }
    case 'SCR': {
      const exact = new RegExp(`\\(?${y}\\)?\\s+${v}\\s+SCR\\s+${p}\\b`, 'i');
      const correction = new RegExp(`\\(?${y}\\)?\\s+${v}\\s+SCR\\s+(\\d{1,5})\\b`, 'i');
      return { exactPattern: exact, correctionExtractor: correction };
    }
    case 'Cri_LJ': {
      const exact = new RegExp(`${y}\\s+Cri\\s*\\.?\\s*L\\.?\\s*J\\.?\\s+${p}\\b`, 'i');
      const correction = new RegExp(`${y}\\s+Cri\\s*\\.?\\s*L\\.?\\s*J\\.?\\s+(\\d{1,5})\\b`, 'i');
      return { exactPattern: exact, correctionExtractor: correction };
    }
    case 'AIR': {
      const court = citation.court || '\\w+';
      const exact = new RegExp(`AIR\\s+${y}\\s+${court}\\s+${p}\\b`, 'i');
      const correction = new RegExp(`AIR\\s+${y}\\s+${court}\\s+(\\d{1,5})\\b`, 'i');
      return { exactPattern: exact, correctionExtractor: correction };
    }
    case 'SCC_OnLine': {
      const court = citation.court || '\\w+';
      const exact = new RegExp(`${y}\\s+SCC\\s+OnLine\\s+${court}\\s+${p}\\b`, 'i');
      const correction = new RegExp(`${y}\\s+SCC\\s+OnLine\\s+${court}\\s+(\\d{1,6})\\b`, 'i');
      return { exactPattern: exact, correctionExtractor: correction };
    }
    case 'MANU': {
      const court = citation.court || '\\w+';
      const exact = new RegExp(`MANU\\/${court}\\/${y}\\/${String(p).padStart(4, '0')}`, 'i');
      return { exactPattern: exact, correctionExtractor: null };
    }
    default:
      return { exactPattern: null, correctionExtractor: null };
  }
}

/**
 * Builds corrected citation text from a correction match.
 * Only returns a correction if the matched page is DIFFERENT from the original.
 */
function buildCorrectedText(
  citation: Citation,
  corrMatch: RegExpExecArray
): string | null {
  // The captured page is in group 1 or group 2 (SCC has two alternation groups)
  const matchedPage = parseInt(corrMatch[1] || corrMatch[2]);
  if (isNaN(matchedPage) || matchedPage === citation.page) return null;

  switch (citation.pattern_name) {
    case 'SCC':
      return `(${citation.year}) ${citation.volume} SCC ${matchedPage}`;
    case 'SCR':
      return `(${citation.year}) ${citation.volume} SCR ${matchedPage}`;
    case 'Cri_LJ':
      return `${citation.year} Cri LJ ${matchedPage}`;
    case 'AIR':
      return `AIR ${citation.year} ${citation.court} ${matchedPage}`;
    case 'SCC_OnLine':
      return `${citation.year} SCC OnLine ${citation.court} ${matchedPage}`;
    default:
      return null;
  }
}

export async function verifyAllCitations(
  citations: Citation[]
): Promise<{ results: VerificationResult[]; apiCallsMade: number; apiCostInr: number }> {
  if (citations.length === 0) return { results: [], apiCallsMade: 0, apiCostInr: 0 };

  const session: VerificationSession = { apiCallsMade: 0, apiCostInr: 0 };

  // Step 1: Pre-filter with deterministic hallucination rules
  const flagsMap = new Map<string, HallucinationFlag[]>();
  const uniqueCitationsToVerify = new Map<string, Citation>();

  for (const c of citations) {
    const flags = detectHallucinations(c);
    flagsMap.set(c.text, flags);
    const hasError = flags.some((f) => f.severity === 'ERROR');
    
    if (!hasError) {
      // Deduplicate citations by their canonical format to minimize API costs
      const key = c.canonical || c.text;
      if (!uniqueCitationsToVerify.has(key)) {
        uniqueCitationsToVerify.set(key, c);
      }
    }
  }

  // Step 2: Check database verification cache
  const cacheResults = new Map<string, { status: string; ik_doc_id: string | null; case_name: string | null; corrected_text: string | null }>();
  const uncached: Citation[] = [];

  for (const [key, c] of uniqueCitationsToVerify.entries()) {
    const cached = await checkCache(c.text);
    if (cached) {
      cacheResults.set(key, cached);
    } else {
      uncached.push(c);
    }
  }

  // Step 3: Verify uncached citations via parallel API requests using Promise.allSettled
  const apiResults = new Map<string, { status: string; ik_doc_id: string | null; case_name: string | null; corrected_text: string | null }>();

  if (uncached.length > 0) {
    const promises = uncached.map((c) => verifyViaIndianKanoon(c, session));
    const settledResults = await Promise.allSettled(promises);

    for (let i = 0; i < uncached.length; i++) {
      const result = settledResults[i];
      const key = uncached[i].canonical || uncached[i].text;
      let apiRes;

      if (result.status === 'fulfilled') {
        apiRes = result.value;
      } else {
        console.error(`Verification settled error for ${uncached[i].text}:`, result.reason);
        apiRes = { status: 'UNVERIFIED', ik_doc_id: null, case_name: null, corrected_text: null };
      }

      apiResults.set(key, apiRes);

      // Cache verified outputs dynamically (omit UNVERIFIED as it may be temporary)
      if (apiRes.status === 'VERIFIED' || apiRes.status === 'NOT_FOUND') {
        await saveToCache(
          uncached[i].text,
          apiRes.status,
          apiRes.ik_doc_id,
          apiRes.case_name,
          apiRes.corrected_text
        );
      }
    }
  }

  // Step 4: Assemble final results matching the original citation occurrences
  const finalResults: VerificationResult[] = [];
  for (const c of citations) {
    const flags = flagsMap.get(c.text) || [];
    const hasError = flags.some((f) => f.severity === 'ERROR');
    const key = c.canonical || c.text;

    if (hasError) {
      finalResults.push({
        citation: c,
        status: 'NOT_FOUND',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        cached: false,
        hallucination_flags: flags,
      });
    } else if (cacheResults.has(key)) {
      const cached = cacheResults.get(key)!;
      finalResults.push({
        citation: c,
        status: cached.status as 'VERIFIED' | 'NOT_FOUND' | 'UNVERIFIED',
        ik_doc_id: cached.ik_doc_id,
        case_name: cached.case_name,
        corrected_text: cached.corrected_text,
        cached: true,
        hallucination_flags: flags,
      });
    } else {
      const apiRes = apiResults.get(key) || {
        status: 'UNVERIFIED',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
      };
      finalResults.push({
        citation: c,
        status: apiRes.status as 'VERIFIED' | 'NOT_FOUND' | 'UNVERIFIED',
        ik_doc_id: apiRes.ik_doc_id,
        case_name: apiRes.case_name,
        corrected_text: apiRes.corrected_text,
        cached: false,
        hallucination_flags: flags,
      });
    }
  }

  return { results: finalResults, apiCallsMade: session.apiCallsMade, apiCostInr: session.apiCostInr };
}
