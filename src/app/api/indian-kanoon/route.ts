import { NextRequest, NextResponse } from 'next/server';

async function handleSearch(formInput: string | null) {
  if (!formInput) {
    return NextResponse.json({ error: 'Missing formInput' }, { status: 400 });
  }

  const apiKey = process.env.INDIAN_KANOON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'IK API key not configured' }, { status: 500 });
  }

  try {
    const url = 'https://api.indiankanoon.org/search/';
    console.log(`[Proxy] Fetching from Indian Kanoon (POST) for formInput: "${formInput}"`);
    
    const body = new URLSearchParams();
    body.append('formInput', formInput);
    body.append('pagenum', '0');

    // Call IK search API using POST
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[Proxy] Indian Kanoon API returned status ${res.status}`);
      return NextResponse.json({ error: `IK API returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[Proxy] Indian Kanoon proxy error:', e);
    return NextResponse.json({ error: e.message || 'Internal proxy connection error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const formInput = request.nextUrl.searchParams.get('formInput');
  return handleSearch(formInput);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const formInput = body.formInput;
    return handleSearch(formInput);
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }
}
