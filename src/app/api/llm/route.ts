import { NextRequest, NextResponse } from 'next/server';
import { extractCitations } from '@/lib/citation-extractor';
import { verifyAllCitations } from '@/lib/citation-verifier';
import { normalizeSections } from '@/lib/section-normalizer';
import { annotateTextAndReport } from '@/lib/citation-annotator';

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

/**
 * Detects if a 429 error is a per-minute rate limit (retryable after short delay)
 * vs a daily quota exhaustion (not retryable, skip immediately).
 */
function parseRateLimitError(errorBody: string): { isDailyQuota: boolean; retryAfterMs: number } {
  try {
    const parsed = JSON.parse(errorBody);
    const details = parsed?.error?.details || [];
    const isDailyQuota = details.some((d: any) =>
      d.violations?.some((v: any) => v.quotaId?.includes('PerDay'))
    );
    const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo'));
    const retryDelay = retryInfo?.retryDelay || '3s';
    const retryAfterMs = Math.min(parseFloat(retryDelay) * 1000, 5000); // cap at 5s
    return { isDailyQuota, retryAfterMs };
  } catch {
    return { isDailyQuota: false, retryAfterMs: 3000 };
  }
}

async function callGemini(query: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: query }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text();

    // For 429 rate limits: check if it's per-minute (retryable) or daily (skip)
    if (res.status === 429) {
      const { isDailyQuota, retryAfterMs } = parseRateLimitError(body);
      if (!isDailyQuota && retryAfterMs > 0) {
        console.warn(`  ⏳ Gemini per-minute rate limit hit. Retrying in ${retryAfterMs}ms...`);
        await new Promise((r) => setTimeout(r, retryAfterMs));
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: query }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { temperature: 0.3 },
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }
      }
      throw new Error(`RATE_LIMIT_${isDailyQuota ? 'DAILY' : 'MINUTE'}`);
    }

    throw new Error(`Gemini API error: ${res.status} ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function callGroq(query: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

async function generateLLMResponse(query: string): Promise<{ text: string; provider: string; keysTried: number }> {
  const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean);
  const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean);
  let keysTried = 0;

  console.log(`\n🔑 LLM Key Rotation — ${geminiKeys.length} Gemini key(s), ${groqKeys.length} Groq key(s) available`);

  // Try all Gemini keys
  for (let i = 0; i < geminiKeys.length; i++) {
    keysTried++;
    try {
      console.log(`  → Trying Gemini key ${i + 1}/${geminiKeys.length}...`);
      const text = await callGemini(query, geminiKeys[i]);
      console.log(`  ✅ Gemini key ${i + 1} succeeded.`);
      return { text, provider: 'Gemini', keysTried };
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('RATE_LIMIT_DAILY')) {
        console.warn(`  ❌ Gemini key ${i + 1}: Daily quota exhausted → rotating to next key`);
      } else if (msg.includes('RATE_LIMIT_MINUTE')) {
        console.warn(`  ⚠️ Gemini key ${i + 1}: Per-minute rate limit (retry failed) → rotating to next key`);
      } else {
        console.error(`  ❌ Gemini key ${i + 1}: ${msg.substring(0, 150)}`);
      }
    }
  }

  console.log(`  🔄 All Gemini keys exhausted. Falling back to Groq...`);

  // Fallback: try all Groq keys
  for (let i = 0; i < groqKeys.length; i++) {
    keysTried++;
    try {
      console.log(`  → Trying Groq key ${i + 1}/${groqKeys.length}...`);
      const text = await callGroq(query, groqKeys[i]);
      console.log(`  ✅ Groq key ${i + 1} succeeded.`);
      return { text, provider: 'Groq (Llama 3.3 70B)', keysTried };
    } catch (e: any) {
      console.error(`  ❌ Groq key ${i + 1}: ${(e.message || '').substring(0, 150)}`);
    }
  }

  throw new Error('All LLM API keys exhausted — no Gemini or Groq keys could generate a response');
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
    const citations = await extractCitations(rawResponse);
    const normalization = await normalizeSections(rawResponse);
    const { results: verifications, apiCallsMade, apiCostInr } = await verifyAllCitations(citations);
    const { annotatedText, report } = annotateTextAndReport(
      rawResponse,
      verifications,
      normalization,
      apiCallsMade,
      apiCostInr
    );

    return NextResponse.json({
      raw_response: rawResponse,
      enhanced_response: annotatedText,
      citations: verifications,
      normalization,
      report,
      provider_used: provider,
      keys_tried: keysTried,
    });
  } catch (e: any) {
    console.error('LLM route error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
