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
      .select('*')
      .eq('citation_text', citationText)
      .single();
    if (error || !data) return null;
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
    const url = `https://api.indiankanoon.org/search/?formInput=${encodeURIComponent(citation.text)}&pagenum=0`;
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

      // Check for page correction in SCC citations
      let corrected_text: string | null = null;
      if (citation.pattern_name === 'SCC') {
        const m = title.match(/\((\d{4})\)\s+(\d{1,2})\s+SCC\s+(\d{1,5})/);
        if (m) {
          const tYear = parseInt(m[1]);
          const tVol = parseInt(m[2]);
          const tPage = parseInt(m[3]);
          if (tYear === citation.year && tVol === citation.volume && tPage !== citation.page) {
            corrected_text = `(${tYear}) ${tVol} SCC ${tPage}`;
          }
        }
      }

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

  // Step 1: Pre-filter with hallucination detector
  const flagsMap = new Map<string, HallucinationFlag[]>();
  const citationsToVerify: Citation[] = [];

  for (const c of citations) {
    const flags = detectHallucinations(c);
    flagsMap.set(c.text, flags);
    const hasError = flags.some((f) => f.severity === 'ERROR');
    if (!hasError) citationsToVerify.push(c);
  }

  // Step 2: Check cache for non-hallucinated citations
  const cacheResults = new Map<string, { status: string; ik_doc_id: string | null; case_name: string | null; corrected_text: string | null }>();
  const uncached: Citation[] = [];

  for (const c of citationsToVerify) {
    const cached = await checkCache(c.text);
    if (cached) {
      cacheResults.set(c.text, cached);
    } else {
      uncached.push(c);
    }
  }

  // Step 3: Verify uncached citations via IK API IN PARALLEL
  const apiResults = new Map<string, { status: string; ik_doc_id: string | null; case_name: string | null; corrected_text: string | null }>();

  if (uncached.length > 0) {
    const promises = uncached.map((c) => verifyViaIndianKanoon(c, session));
    const results = await Promise.all(promises);
    for (let i = 0; i < uncached.length; i++) {
      apiResults.set(uncached[i].text, results[i]);
      // Cache VERIFIED and NOT_FOUND (not UNVERIFIED which may be transient)
      if (results[i].status === 'VERIFIED' || results[i].status === 'NOT_FOUND') {
        await saveToCache(
          uncached[i].text,
          results[i].status,
          results[i].ik_doc_id,
          results[i].case_name,
          results[i].corrected_text
        );
      }
    }
  }

  // Step 4: Assemble final results
  const finalResults: VerificationResult[] = [];
  for (const c of citations) {
    const flags = flagsMap.get(c.text) || [];
    const hasError = flags.some((f) => f.severity === 'ERROR');

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
    } else if (cacheResults.has(c.text)) {
      const cached = cacheResults.get(c.text)!;
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
      const apiRes = apiResults.get(c.text) || {
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
