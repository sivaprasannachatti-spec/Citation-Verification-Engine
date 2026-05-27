import { supabase } from './supabase';
import { Citation, VerificationResult, HallucinationFlag, CitationPattern } from './types';
import { detectHallucinations } from './hallucination-detector';

const CACHE_VERSION = 2; // Incremented cache schema version

const OVERRULED_CASES: Record<string, string> = {
  '(2017) 9 SCC 1': '(2018) 10 SCC 443 (Social Action Forum for Manav Adhikar v. Union of India)',
  '(2014) 1 SCC 1': '(2018) 10 SCC 1 (Navtej Singh Johar v. Union of India)',
  '(1976) 2 SCC 521': '(2017) 10 SCC 1 (K.S. Puttaswamy v. Union of India)',
  'AIR 1967 SC 1643': '(1973) 4 SCC 225 (Kesavananda Bharati v. State of Kerala)',
};

const MAJOR_REPORTERS = new Set(['SCC', 'SCR', 'AIR', 'Cri_LJ', 'SCC_OnLine']);

interface VerificationSession {
  apiCallsMade: number;
  apiCostInr: number;
  mode: 'LIVE_VERIFIED' | 'CACHE_VERIFIED' | 'DEGRADED_MODE';
}

function checkOverruled(citation: Citation): string | null {
  const canonical = citation.canonical || '';
  const normCanonical = canonical.replace(/\s+/g, '').toUpperCase();
  for (const [overruledKey, overrulingCase] of Object.entries(OVERRULED_CASES)) {
    if (normCanonical === overruledKey.replace(/\s+/g, '').toUpperCase()) {
      return overrulingCase;
    }
  }
  return null;
}

async function checkCache(citationText: string): Promise<{
  status: string;
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
  reasoning: string;
} | null> {
  try {
    // 1. Attempt schema-aware read with cache_version and cache_metadata
    const { data, error } = await supabase
      .from('verification_cache')
      .select('status, ik_doc_id, case_name, corrected_text, verified_at, cache_version, cache_metadata')
      .eq('citation_text', citationText)
      .single();

    if (error || !data) {
      if (error && error.code === 'PGRST116') {
        // Entry not found, normal miss
        return null;
      }
      
      // Fallback: If cache_version column is missing in legacy DB schema
      const { data: legacyData, error: legacyError } = await supabase
        .from('verification_cache')
        .select('status, ik_doc_id, case_name, corrected_text, verified_at')
        .eq('citation_text', citationText)
        .single();
      
      if (legacyError || !legacyData) return null;

      // Invalidate legacy entry (version 0 < CACHE_VERSION)
      console.log(`[Cache] Invalidating legacy cache entry (v0) for "${citationText}"`);
      return null;
    }

    // 2. Validate cache version (version mismatch invalidation)
    if (data.cache_version !== CACHE_VERSION) {
      console.log(`[Cache] Cache version mismatch for "${citationText}": expected ${CACHE_VERSION}, got ${data.cache_version}. Invalidating...`);
      return null;
    }

    // 3. TTL Check: 30-day cache freshness check
    const cacheAgeMs = Date.now() - new Date(data.verified_at).getTime();
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    if (cacheAgeMs > maxAgeMs) {
      console.log(`[Cache] Cache entry for "${citationText}" is stale (>30 days). Re-evaluating...`);
      return null;
    }

    return {
      status: data.status,
      ik_doc_id: data.ik_doc_id,
      case_name: data.case_name,
      corrected_text: data.corrected_text || null,
      reasoning: (data.cache_metadata as any)?.reasoning || 'Verified from system cache index.',
    };
  } catch (e) {
    console.error('[Cache] Cache retrieval failure:', e);
    return null;
  }
}

async function saveToCache(
  citationText: string,
  status: string,
  ikDocId: string | null,
  caseName: string | null,
  correctedText: string | null,
  reasoning: string
): Promise<void> {
  try {
    const payload = {
      citation_text: citationText,
      status,
      ik_doc_id: ikDocId,
      case_name: caseName,
      corrected_text: correctedText,
      verified_at: new Date().toISOString(),
      cache_version: CACHE_VERSION,
      cache_metadata: { reasoning },
    };

    const { error } = await supabase.from('verification_cache').upsert(payload);
    if (error) {
      // Fallback if cache_version/cache_metadata columns do not exist in active database schema
      await supabase.from('verification_cache').upsert({
        citation_text: citationText,
        status,
        ik_doc_id: ikDocId,
        case_name: caseName,
        corrected_text: correctedText,
        verified_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[Cache] Failed to save to verification cache:', e);
  }
}

async function verifyViaIndianKanoon(
  citation: Citation,
  session: VerificationSession
): Promise<{
  status: 'VERIFIED' | 'NOT_FOUND' | 'UNVERIFIED';
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
  reasoning: string;
}> {
  const apiKey = process.env.INDIAN_KANOON_API_KEY;
  if (!apiKey) {
    console.error('INDIAN_KANOON_API_KEY not set');
    session.mode = 'DEGRADED_MODE';
    return {
      status: 'UNVERIFIED',
      ik_doc_id: null,
      case_name: null,
      corrected_text: null,
      reasoning: 'Verification degraded: Indian Kanoon API key is not configured in backend settings.',
    };
  }

  session.apiCallsMade++;
  session.apiCostInr += 1.0;

  try {
    const searchQuery = citation.canonical || citation.text;
    console.log(`[API] Querying Indian Kanoon (POST) for: "${searchQuery}"`);

    const url = 'https://api.indiankanoon.org/search/';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        formInput: searchQuery,
        pagenum: 0
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[API] Indian Kanoon error response: ${res.status}`);
      session.mode = 'DEGRADED_MODE';
      return {
        status: 'UNVERIFIED',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        reasoning: `Verification degraded: Indian Kanoon search returned server error status ${res.status}.`,
      };
    }

    const data = await res.json();
    const docs = data.docs || [];

    if (docs.length === 0) {
      // Semantic classification: If it's a major reporter and we get 0 docs, it is fabricated (REMOVED)
      if (MAJOR_REPORTERS.has(citation.pattern_name)) {
        return {
          status: 'NOT_FOUND',
          ik_doc_id: null,
          case_name: null,
          corrected_text: null,
          reasoning: `Fabricated citation: Comprehensive search of major legal reporter "${citation.pattern_name}" yielded zero matching records.`,
        };
      }
      // Otherwise, if obscure or unknown, classify as UNVERIFIED
      return {
        status: 'UNVERIFIED',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        reasoning: 'Unverified: Citation exists structurally but yielded zero search hits. Obscure report may be real.',
      };
    }

    // Load patterns to validate title and headlines
    const patterns = await loadPatternsCached();
    const pat = patterns.find((p) => p.pattern_name === citation.pattern_name);

    if (!pat) {
      // Fallback verification status for unknown formats
      return {
        status: 'UNVERIFIED',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        reasoning: 'Unverified: Citation uses unregistered layout format; search records exist but could not be parsed dynamically.',
      };
    }

    const validationResult = validateIKResults(citation, pat, docs);
    return validationResult;
  } catch (e: any) {
    console.error('[API] Live verification fetch failed:', e);
    session.mode = 'DEGRADED_MODE';
    return {
      status: 'UNVERIFIED',
      ik_doc_id: null,
      case_name: null,
      corrected_text: null,
      reasoning: `Verification degraded: Connection attempt failed or timed out (${e.message || 'unknown'}).`,
    };
  }
}

let cachedPatternsList: CitationPattern[] | null = null;
async function loadPatternsCached(): Promise<CitationPattern[]> {
  if (cachedPatternsList) return cachedPatternsList;
  try {
    const { data } = await supabase.from('citation_patterns').select('*');
    if (data && data.length > 0) {
      cachedPatternsList = data as CitationPattern[];
      return cachedPatternsList;
    }
  } catch {}
  return [];
}

function stripHtml(str: string): string {
  return str.replace(/<\/?b>/gi, '').replace(/<[^>]*>/g, '');
}

function buildDynamicValidationPatterns(
  citation: Citation,
  pattern: CitationPattern
): {
  exactPattern: RegExp | null;
  correctionExtractor: RegExp | null;
} {
  const y = citation.year;
  const v = citation.volume;
  const p = citation.page;
  const court = citation.court || '\\w+';

  const template = pattern.format_template;

  let exactStr = template
    .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    .replace('\\{year\\}', String(y))
    .replace('\\{volume\\}', String(v || ''))
    .replace('\\{page\\}', String(p))
    .replace('\\{court\\}', court);

  exactStr = exactStr.replace(/\\s+/g, '\\s+').replace(/\s+/g, '\\s+');

  let corrStr = template
    .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    .replace('\\{year\\}', String(y))
    .replace('\\{volume\\}', String(v || ''))
    .replace('\\{page\\}', '(\\d{1,6})')
    .replace('\\{court\\}', court);

  corrStr = corrStr.replace(/\\s+/g, '\\s+').replace(/\s+/g, '\\s+');

  // Variations for specific known patterns
  if (pattern.pattern_name === 'SCC') {
    exactStr = `(?:${exactStr}|${y}\\s+SCC\\s*\\(?${v}\\)?\\s+${p}\\b)`;
    corrStr = `(?:${corrStr}|${y}\\s+SCC\\s*\\(?${v}\\)?\\s+(\\d{1,5})\\b)`;
  } else if (pattern.pattern_name === 'Cri_LJ') {
    exactStr = `${y}\\s+Cri\\s*\\.?\\s*L\\.?\\s*J\\.?\\s+${p}\\b`;
    corrStr = `${y}\\s+Cri\\s*\\.?\\s*L\\.?\\s*J\\.?\\s+(\\d{1,5})\\b`;
  }

  return {
    exactPattern: new RegExp(exactStr, 'i'),
    correctionExtractor: new RegExp(corrStr, 'i'),
  };
}

function buildCorrectedText(
  citation: Citation,
  corrMatch: RegExpExecArray
): string | null {
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

function validateIKResults(
  citation: Citation,
  pattern: CitationPattern,
  docs: Array<{ tid?: number; title?: string; headline?: string }>
): {
  status: 'VERIFIED' | 'NOT_FOUND' | 'UNVERIFIED';
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
  reasoning: string;
} {
  const { exactPattern, correctionExtractor } = buildDynamicValidationPatterns(citation, pattern);

  if (!exactPattern) {
    const top = docs[0];
    return {
      status: 'VERIFIED',
      ik_doc_id: String(top.tid || ''),
      case_name: stripHtml(top.title || 'Unknown'),
      corrected_text: null,
      reasoning: 'Verified fallback context match.',
    };
  }

  // Pass 1: Check ALL docs for an EXACT citation match
  for (const doc of docs) {
    const searchable = stripHtml(`${doc.title || ''} ${doc.headline || ''}`);
    if (exactPattern.test(searchable)) {
      return {
        status: 'VERIFIED',
        ik_doc_id: String(doc.tid || ''),
        case_name: stripHtml(doc.title || 'Unknown'),
        corrected_text: null,
        reasoning: 'Exact citation matched successfully in Indian Kanoon search results.',
      };
    }
  }

  // Pass 2: Check ALL docs for a CORRECTABLE match (same year/volume, different page)
  if (correctionExtractor) {
    for (const doc of docs) {
      const searchable = stripHtml(`${doc.title || ''} ${doc.headline || ''}`);
      const corrMatch = correctionExtractor.exec(searchable);
      correctionExtractor.lastIndex = 0; // reset
      if (corrMatch) {
        const correctedText = buildCorrectedText(citation, corrMatch);
        if (correctedText) {
          return {
            status: 'VERIFIED',
            ik_doc_id: String(doc.tid || ''),
            case_name: stripHtml(doc.title || 'Unknown'),
            corrected_text: correctedText,
            reasoning: `Citation details corrected: page mismatch reconciled dynamically from ${citation.page} to corrected value.`,
          };
        }
      }
    }
  }

  // Pass 3: If major reporter, it is fabricated. If obscure, classify as UNVERIFIED
  if (MAJOR_REPORTERS.has(citation.pattern_name)) {
    return {
      status: 'NOT_FOUND',
      ik_doc_id: null,
      case_name: null,
      corrected_text: null,
      reasoning: `Fabricated citation: Search results matched name queries but did not contain records matching page/volume details of "${citation.pattern_name}".`,
    };
  }

  return {
    status: 'UNVERIFIED',
    ik_doc_id: null,
    case_name: null,
    corrected_text: null,
    reasoning: 'Unverified: Context match details could not be validated in Indian Kanoon database records.',
  };
}

// Bounded Concurrency + Exponential Backoff Throttling Engine
async function verifyWithThrottling<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrencyLimit: number = 5,
  maxRetries: number = 2
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      
      let attempt = 0;
      let success = false;
      let lastError: any;
      
      while (attempt <= maxRetries && !success) {
        try {
          results[currentIndex] = await fn(item);
          success = true;
        } catch (error) {
          lastError = error;
          attempt++;
          if (attempt <= maxRetries) {
            const delay = Math.pow(2, attempt) * 500; // exponential backoff
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      
      if (!success) {
        // Fallback result after exhausts retries
        results[currentIndex] = {
          status: 'UNVERIFIED',
          ik_doc_id: null,
          case_name: null,
          corrected_text: null,
          reasoning: `API lookup failed after ${maxRetries} retries: ${lastError?.message || 'timeout error'}.`
        } as any;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function verifyAllCitations(
  citations: Citation[]
): Promise<{
  results: VerificationResult[];
  apiCallsMade: number;
  apiCostInr: number;
  pipelineMode: 'LIVE_VERIFIED' | 'CACHE_VERIFIED' | 'DEGRADED_MODE';
}> {
  if (citations.length === 0) {
    return { results: [], apiCallsMade: 0, apiCostInr: 0, pipelineMode: 'LIVE_VERIFIED' };
  }

  const session: VerificationSession = {
    apiCallsMade: 0,
    apiCostInr: 0,
    mode: 'LIVE_VERIFIED', // Default mode
  };

  const flagsMap = new Map<string, HallucinationFlag[]>();
  const uniqueCitationsToVerify = new Map<string, Citation>();

  // Step 1: Pre-filter with deterministic rules
  for (const c of citations) {
    const flags = detectHallucinations(c);
    flagsMap.set(c.text, flags);
    const hasError = flags.some((f) => f.severity === 'ERROR');
    
    if (!hasError && c.pattern_name !== 'UNKNOWN_FORMAT') {
      const key = c.canonical || c.text;
      if (!uniqueCitationsToVerify.has(key)) {
        uniqueCitationsToVerify.set(key, c);
      }
    }
  }

  // Step 2: Check database verification cache
  const cacheResults = new Map<
    string,
    { status: string; ik_doc_id: string | null; case_name: string | null; corrected_text: string | null; reasoning: string }
  >();
  const uncached: Citation[] = [];

  for (const [key, c] of uniqueCitationsToVerify.entries()) {
    const cached = await checkCache(c.text);
    if (cached) {
      cacheResults.set(key, cached);
    } else {
      uncached.push(c);
    }
  }

  // Determine baseline mode: If all were cached, system operates in CACHE_VERIFIED mode
  if (uncached.length === 0 && uniqueCitationsToVerify.size > 0) {
    session.mode = 'CACHE_VERIFIED';
  }

  // Step 3: Verify uncached citations via parallel API requests with throttling and retries
  const apiResults = new Map<
    string,
    { status: 'VERIFIED' | 'NOT_FOUND' | 'UNVERIFIED'; ik_doc_id: string | null; case_name: string | null; corrected_text: string | null; reasoning: string }
  >();

  if (uncached.length > 0) {
    const verifications = await verifyWithThrottling(
      uncached,
      (c) => verifyViaIndianKanoon(c, session),
      5, // limit 5 active concurrent calls
      2  // retry 2 times on connection errors
    );

    for (let i = 0; i < uncached.length; i++) {
      const apiRes = verifications[i];
      const key = uncached[i].canonical || uncached[i].text;

      apiResults.set(key, apiRes);

      // Cache verified outputs dynamically (omit UNVERIFIED as it may be temporary connection failure)
      if (apiRes.status === 'VERIFIED' || apiRes.status === 'NOT_FOUND') {
        await saveToCache(
          uncached[i].text,
          apiRes.status,
          apiRes.ik_doc_id,
          apiRes.case_name,
          apiRes.corrected_text,
          apiRes.reasoning
        );
      }
    }
  }

  // Step 4: Assemble final results mapping back to citation occurrences
  const finalResults: VerificationResult[] = [];
  for (const c of citations) {
    const flags = flagsMap.get(c.text) || [];
    const hasError = flags.some((f) => f.severity === 'ERROR');
    const key = c.canonical || c.text;

    // Check relationship overrulings
    const overrulingWarning = checkOverruled(c);
    if (overrulingWarning) {
      flags.push({
        rule: 'RULE 5 — OVERRULED PRECEDENT',
        description: `Citation Relationship Warning: Case [${c.canonical || c.text}] is overruled or modified by ${overrulingWarning}.`,
        severity: 'WARNING',
      });
    }

    if (hasError) {
      const errorMsg = flags.find((f) => f.severity === 'ERROR')?.description || 'Hallucination rules flagged error.';
      finalResults.push({
        citation: c,
        status: 'NOT_FOUND',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        cached: false,
        hallucination_flags: flags,
        reasoning: `Hallucination rules triggered: ${errorMsg}`,
      });
    } else if (c.pattern_name === 'UNKNOWN_FORMAT') {
      finalResults.push({
        citation: c,
        status: 'UNVERIFIED',
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        cached: false,
        hallucination_flags: flags,
        reasoning: 'Detected as unknown citation format. Obscure citation format may be real but is not actively registered in verification database.',
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
        reasoning: cached.reasoning,
      });
    } else {
      const apiRes = apiResults.get(key) || {
        status: 'UNVERIFIED' as const,
        ik_doc_id: null,
        case_name: null,
        corrected_text: null,
        reasoning: 'Unverified: API lookup yielded no verification metrics.',
      };
      finalResults.push({
        citation: c,
        status: apiRes.status,
        ik_doc_id: apiRes.ik_doc_id,
        case_name: apiRes.case_name,
        corrected_text: apiRes.corrected_text,
        cached: false,
        hallucination_flags: flags,
        reasoning: apiRes.reasoning,
      });
    }
  }

  return {
    results: finalResults,
    apiCallsMade: session.apiCallsMade,
    apiCostInr: session.apiCostInr,
    pipelineMode: session.mode,
  };
}
