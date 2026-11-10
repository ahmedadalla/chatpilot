import { NextRequest, NextResponse } from 'next/server';
import { getInternalApiUrl, getAccessToken } from '../../../../../lib/bff-cookies';

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const apiUrl = getInternalApiUrl();

    const res = await fetch(`${apiUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'MFA verify error';
    return NextResponse.json({ code: 'MFA_VERIFY_ERROR', message }, { status: 500 });
  }
}
