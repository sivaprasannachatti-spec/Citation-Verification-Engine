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

    if (docs.length > 0) {
      const top = docs[0];
      const title = top.title || 'Unknown';
      const tid = String(top.tid || '');

      // Check for page number mismatch corrections in SCC / SCR citation formats
      let corrected_text: string | null = null;
      if (citation.pattern_name === 'SCC') {
        const m = title.match(/\((\d{4})\)\s+(\d{1,2})\s+SCC\s+(\d{1,5})/i);
        if (m) {
          const tYear = parseInt(m[1]);
          const tVol = parseInt(m[2]);
          const tPage = parseInt(m[3]);
          if (tYear === citation.year && tVol === citation.volume && tPage !== citation.page) {
            corrected_text = `(${tYear}) ${tVol} SCC ${tPage}`;
          }
        }
      } else if (citation.pattern_name === 'SCR') {
        const m = title.match(/\((\d{4})\)\s+(\d{1,2})\s+SCR\s+(\d{1,5})/i);
        if (m) {
          const tYear = parseInt(m[1]);
          const tVol = parseInt(m[2]);
          const tPage = parseInt(m[3]);
          if (tYear === citation.year && tVol === citation.volume && tPage !== citation.page) {
            corrected_text = `(${tYear}) ${tVol} SCR ${tPage}`;
          }
        }
      }

      // If the page is corrected, it represents a CORRECTED status rather than just VERIFIED
      return { status: 'VERIFIED', ik_doc_id: tid, case_name: title, corrected_text };
    }

    return { status: 'NOT_FOUND', ik_doc_id: null, case_name: null, corrected_text: null };
  } catch (e) {
    console.error('IK API call failed:', e);
    return { status: 'UNVERIFIED', ik_doc_id: null, case_name: null, corrected_text: null };
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
