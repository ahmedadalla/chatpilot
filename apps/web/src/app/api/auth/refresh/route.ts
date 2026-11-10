import { NextRequest, NextResponse } from 'next/server';
import {
  getInternalApiUrl,
  getRefreshToken,
  setSessionCookies,
  clearSessionCookies,
} from '../../../../lib/bff-cookies';

export async function POST(_req: NextRequest) {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSessionCookies();
      return NextResponse.json(
        { code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token' },
        { status: 401 },
      );
    }

    const apiUrl = getInternalApiUrl();
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json();
    if (!res.ok) {
      clearSessionCookies();
      return NextResponse.json(data, { status: res.status });
    }

    const setCookieHeader = res.headers.get('set-cookie');
    let newRefreshToken: string | undefined = undefined;
    if (setCookieHeader) {
      const match = setCookieHeader.match(/cp_rft=([^;]+)/);
      if (match) newRefreshToken = match[1];
    }

    setSessionCookies(data.accessToken, newRefreshToken);
    return NextResponse.json({ success: true, accessToken: data.accessToken });
  } catch (err: unknown) {
    clearSessionCookies();
    const message = err instanceof Error ? err.message : 'Refresh failed';
    return NextResponse.json({ code: 'REFRESH_ERROR', message }, { status: 500 });
  }
}
