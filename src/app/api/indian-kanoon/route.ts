import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const formInput = request.nextUrl.searchParams.get('formInput');
    if (!formInput) return NextResponse.json({ error: 'Missing formInput' }, { status: 400 });

    const apiKey = process.env.INDIAN_KANOON_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'IK API key not configured' }, { status: 500 });

    const url = `https://api.indiankanoon.org/search/?formInput=${encodeURIComponent(formInput)}&pagenum=0`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `IK API returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Indian Kanoon proxy error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
