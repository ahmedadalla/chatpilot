import { NextRequest, NextResponse } from 'next/server';
import { getInternalApiUrl, getAccessToken } from '../../../../../lib/bff-cookies';

export async function POST(_req: NextRequest) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const apiUrl = getInternalApiUrl();
    const res = await fetch(`${apiUrl}/auth/mfa/setup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'MFA setup error';
    return NextResponse.json({ code: 'MFA_SETUP_ERROR', message }, { status: 500 });
  }
}
