import { NextRequest, NextResponse } from 'next/server';
import {
  getInternalApiUrl,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
  clearSessionCookies,
} from '../../../../lib/bff-cookies';

export async function GET(_req: NextRequest) {
  try {
    let accessToken = getAccessToken();
    const apiUrl = getInternalApiUrl();

    if (!accessToken) {
      // Try refresh if access token cookie is missing but refresh token exists
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return NextResponse.json(
          { code: 'UNAUTHORIZED', message: 'No active session' },
          { status: 401 },
        );
      }

      const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) {
        clearSessionCookies();
        return NextResponse.json(
          { code: 'SESSION_EXPIRED', message: 'Session expired' },
          { status: 401 },
        );
      }

      const refreshData = await refreshRes.json();
      accessToken = refreshData.accessToken;
      const setCookieHeader = refreshRes.headers.get('set-cookie');
      let newRefreshToken: string | undefined = undefined;
      if (setCookieHeader) {
        const match = setCookieHeader.match(/cp_rft=([^;]+)/);
        if (match) newRefreshToken = match[1];
      }
      setSessionCookies(accessToken!, newRefreshToken);
    }

    // Call /auth/me
    let meRes = await fetch(`${apiUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (meRes.status === 401) {
      // Access token might have just expired, try one refresh retry
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          accessToken = refreshData.accessToken;
          const setCookieHeader = refreshRes.headers.get('set-cookie');
          let newRefreshToken: string | undefined = undefined;
          if (setCookieHeader) {
            const match = setCookieHeader.match(/cp_rft=([^;]+)/);
            if (match) newRefreshToken = match[1];
          }
          setSessionCookies(accessToken!, newRefreshToken);

          meRes = await fetch(`${apiUrl}/auth/me`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
        }
      }
    }

    const data = await meRes.json();
    if (!meRes.ok) {
      if (meRes.status === 401) clearSessionCookies();
      return NextResponse.json(data, { status: meRes.status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve session';
    return NextResponse.json({ code: 'ME_ERROR', message }, { status: 500 });
  }
}
