import { NextRequest, NextResponse } from 'next/server';
import { getInternalApiUrl } from '../../../../../lib/bff-cookies';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiUrl = getInternalApiUrl();

    const res = await fetch(`${apiUrl}/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reset request failed';
    return NextResponse.json({ code: 'RESET_REQUEST_ERROR', message }, { status: 500 });
  }
}
