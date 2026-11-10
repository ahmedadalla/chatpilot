import { NextRequest, NextResponse } from 'next/server';
import { getInternalApiUrl, setSessionCookies } from '../../../../../lib/bff-cookies';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiUrl = getInternalApiUrl();

    const res = await fetch(`${apiUrl}/auth/invitations/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const setCookieHeader = res.headers.get('set-cookie');
    let refreshToken: string | undefined = undefined;
    if (setCookieHeader) {
      const match = setCookieHeader.match(/cp_rft=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    setSessionCookies(data.accessToken, refreshToken);

    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Accept invitation failed';
    return NextResponse.json({ code: 'INVITATION_ACCEPT_ERROR', message }, { status: 500 });
  }
}
