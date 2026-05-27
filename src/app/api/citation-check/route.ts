import { NextRequest, NextResponse } from 'next/server';
import { extractCitations } from '@/lib/citation-extractor';
import { verifyAllCitations } from '@/lib/citation-verifier';
import { normalizeSections } from '@/lib/section-normalizer';
import { annotateTextAndReport } from '@/lib/citation-annotator';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const citations = await extractCitations(text);
    const normalization = await normalizeSections(text);
    const { results: verifications, apiCallsMade, apiCostInr } = await verifyAllCitations(citations);
    const { annotatedText, segments, report } = annotateTextAndReport(text, verifications, normalization, apiCallsMade, apiCostInr);

    return NextResponse.json({
      original_text: text,
      annotated_text: annotatedText,
      segments,
      citations: verifications,
      normalization,
      report,
    });
  } catch (e: any) {
    console.error('Citation check error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
