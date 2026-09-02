import { NextRequest, NextResponse } from 'next/server';
import { extractCitations } from '@/lib/citation-extractor';
import { verifyAllCitations } from '@/lib/citation-verifier';
import { normalizeSections } from '@/lib/section-normalizer';
import { annotateTextAndReport } from '@/lib/citation-annotator';
import { keysToTry, poolSize, markRateLimited, markInvalid, markHealthy } from '@/lib/mistral-keys';

const SYSTEM_PROMPT = `You are an expert senior Indian criminal lawyer and principal legal systems architect. Answer the user's legal queries, drafts, and pleadings with maximum professional rigor, legal depth, and completeness.

When drafting or analyzing any legal complaint, application, or pleading:
1. ACT LIKE AN EXPERIENCED INDIAN CRIMINAL LAWYER: Write realistic, detailed, and structured legal documents using formal court pleading terminology.
2. INCLUDE ASSOCIATED OFFENCES: A professional legal draft must never be legally shallow or contain only a single primary section. Always include contextually related offences THAT ARE RELEVANT TO THE SPECIFIC QUERY.
   - For instance, if the user asks for a specific crime, do not just list the main section. If relevant, naturally include the related sections for conspiracy, common intention, or breach of trust, etc., depending ENTIRELY on the user's specific facts.
   - IMPORTANT: Tailor the sections entirely to the user's query. Never include unrelated sections.
3. INCLUDE PROCEDURAL & LEGAL GROUNDS: Reference appropriate procedural sections naturally (e.g., procedural sections for police complaints, magistrate applications, maintenance, or electronic evidence) ONLY IF relevant to the user's prompt.
4. STRUCTURE: Include a formal title/caption, detailed factual allegations, specific legal grounds, and a complete "Prayer" section listing the relevant sections for the specific case.
5. CASE PRECEDENTS: When referencing case precedents, ALWAYS cite them using standard Indian citation formats:
   - SCC format: (2024) 5 SCC 123
   - AIR format: AIR 2024 SC 123
   - SCC OnLine format: 2024 SCC OnLine Del 456
   - Cri LJ format: 2024 Cri LJ 789
   - SCR format: (2024) 5 SCR 123
   - MANU format: MANU/SC/0123/2024
Use proper legal analysis with headings and structure. Be thorough, detailed, and professional.`;

const MISTRAL_MODEL = 'mistral-medium-3-5';

async function callMistral(query: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(
      `Mistral API error: ${res.status} ${body.substring(0, 200)}`
    );
    err.status = res.status;
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) err.retryAfterSec = parseInt(retryAfter, 10);
    throw err;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Mistral');
  return text;
}

async function generateLLMResponse(
  query: string
): Promise<{ text: string; provider: string; keysTried: number }> {
  const candidates = keysToTry();
  let keysTried = 0;

  if (candidates.length === 0) {
    throw new Error(
      'No Mistral API keys configured — set MISTRAL_API_KEY_1..N in .env.local'
    );
  }

  console.log(
    `\n🔑 Mistral key rotation — ${candidates.length}/${poolSize()} key(s) available this request`
  );

  let lastError = '';

  for (const key of candidates) {
    keysTried++;
    try {
      console.log(`  → Trying key #${key.index}...`);
      const text = await callMistral(query, key.value);
      markHealthy(key.index);
      console.log(`  ✅ Key #${key.index} succeeded.`);
      return { text, provider: `Mistral (${MISTRAL_MODEL})`, keysTried };
    } catch (e: any) {
      const status = e?.status;
      lastError = e?.message || String(e);

      if (status === 429) {
        markRateLimited(key.index, e.retryAfterSec);
        console.warn(`  ⏳ Key #${key.index}: rate limited → rotating to next key`);
      } else if (status === 401 || status === 403) {
        markInvalid(key.index);
        console.warn(`  ❌ Key #${key.index}: rejected (${status}) → disabled for this process`);
      } else {
        console.error(`  ❌ Key #${key.index}: ${lastError.substring(0, 150)}`);
      }
    }
  }

  throw new Error(
    `All ${keysTried} Mistral key(s) exhausted — last error: ${lastError.substring(0, 200)}`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, mode } = body;

    if (!query || !mode) {
      return NextResponse.json({ error: 'Missing query or mode' }, { status: 400 });
    }

    // Step 1: Generate LLM response (this is the ONLY place AI is used)
    const { text: rawResponse, provider, keysTried } = await generateLLMResponse(query);

    if (mode === 'generic') {
      return NextResponse.json({
        raw_response: rawResponse,
        provider_used: provider,
        keys_tried: keysTried,
      });
    }

    // Step 2: DETERMINISTIC citation safety pipeline (NO AI)
    const t0 = performance.now();
    const trace: Array<{ stage: string; duration_ms: number; details: string }> = [];

    // Stage 1: Citation Extraction
    const t1 = performance.now();
    const citations = await extractCitations(rawResponse);
    trace.push({
      stage: 'Citation Extraction',
      duration_ms: Math.round(performance.now() - t1),
      details: `Extracted ${citations.length} citation candidate(s) (including heuristics & false positive filters).`,
    });

    // Stage 2: Section Normalization
    const t2 = performance.now();
    const normalization = await normalizeSections(rawResponse);
    trace.push({
      stage: 'Section Normalization',
      duration_ms: Math.round(performance.now() - t2),
      details: `Analyzed text and converted ${normalization.replacements.length} legacy section reference(s) to modern BNS/BNSS/BSA codes.`,
    });

    // Stage 3: Verification
    const t3 = performance.now();
    const { results: verifications, apiCallsMade, apiCostInr, pipelineMode } = await verifyAllCitations(citations);
    trace.push({
      stage: 'Kanoon Verification',
      duration_ms: Math.round(performance.now() - t3),
      details: `Executed verification in ${pipelineMode} mode. Performed ${apiCallsMade} API call(s) with bounded throttling.`,
    });

    // Stage 4: Annotation & Report Compilation
    const t4 = performance.now();
    const { annotatedText, segments, report } = annotateTextAndReport(
      rawResponse,
      verifications,
      normalization,
      apiCallsMade,
      apiCostInr
    );
    trace.push({
      stage: 'Annotation & Report Compilation',
      duration_ms: Math.round(performance.now() - t4),
      details: 'Preserved layout, escaped HTML, stripped LLM badge spoof injections, built AST-segments, and verified report invariants.',
    });

    const totalLatency = Math.round(performance.now() - t0);

    const preFilteredCount = verifications.filter((v) =>
      v.hallucination_flags.some((f) => f.severity === 'ERROR')
    ).length;
    const cacheHitCount = verifications.filter((v) => v.cached).length;
    const cacheMissCount = verifications.filter((v) => !v.cached && !v.hallucination_flags.some((f) => f.severity === 'ERROR')).length;

    const enrichedReport = {
      ...report,
      latency_ms: totalLatency,
      pre_filter_savings_inr: preFilteredCount * 1.0,
      cache_diagnostics: {
        hits: cacheHitCount,
        misses: cacheMissCount,
        invalidated: 0,
        version: 2, // CACHE_VERSION
      },
      pipeline_trace: trace,
    };

    return NextResponse.json({
      raw_response: rawResponse,
      enhanced_response: annotatedText,
      segments,
      citations: verifications,
      normalization,
      report: enrichedReport,
      provider_used: provider,
      keys_tried: keysTried,
    });
  } catch (e: any) {
    console.error('LLM route error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
