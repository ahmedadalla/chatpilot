import { NextRequest, NextResponse } from 'next/server';
import {
  getInternalApiUrl,
  getAccessToken,
  clearSessionCookies,
} from '../../../../lib/bff-cookies';

export async function POST(_req: NextRequest) {
  try {
    const accessToken = getAccessToken();
    const apiUrl = getInternalApiUrl();

    if (accessToken) {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => {
        // Ignore upstream network failure during logout
      });
    }

    clearSessionCookies();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    clearSessionCookies();
    const message = err instanceof Error ? err.message : 'Logout error';
    return NextResponse.json({ success: true, message });
  }
}
