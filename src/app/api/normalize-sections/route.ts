import { NextRequest, NextResponse } from 'next/server';
import { normalizeSections } from '@/lib/section-normalizer';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    const result = await normalizeSections(text);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Normalize sections error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
