import { NextRequest, NextResponse } from 'next/server';
import { extractCitations } from '@/lib/citation-extractor';
import { verifyAllCitations } from '@/lib/citation-verifier';
import { normalizeSections } from '@/lib/section-normalizer';
import { annotateTextAndReport } from '@/lib/citation-annotator';

const SYSTEM_PROMPT = `You are a senior Indian legal AI assistant. Answer the user's legal query comprehensively and professionally.
When referencing case precedents, ALWAYS cite them using standard Indian citation formats:
- SCC format: (2024) 5 SCC 123
- AIR format: AIR 2024 SC 123
- SCC OnLine format: 2024 SCC OnLine Del 456
- Cri LJ format: 2024 Cri LJ 789
- SCR format: (2024) 5 SCR 123
- MANU format: MANU/SC/0123/2024
Use proper legal analysis with headings and structure. Be thorough.`;

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
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
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

  // Try all Gemini keys
  for (const key of geminiKeys) {
    keysTried++;
    try {
      const text = await callGemini(query, key);
      return { text, provider: 'Gemini', keysTried };
    } catch (e) {
      console.error(`Gemini key ${keysTried} failed:`, e);
    }
  }

  // Fallback: try all Groq keys
  for (const key of groqKeys) {
    keysTried++;
    try {
      const text = await callGroq(query, key);
      return { text, provider: 'Groq', keysTried };
    } catch (e) {
      console.error(`Groq key ${keysTried} failed:`, e);
    }
  }

  throw new Error('All LLM API keys exhausted');
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
