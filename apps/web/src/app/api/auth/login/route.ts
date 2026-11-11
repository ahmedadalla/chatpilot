import { NextRequest, NextResponse } from 'next/server';
import { getInternalApiUrl, setSessionCookies } from '../../../../lib/bff-cookies';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiUrl = getInternalApiUrl();

    const apiRes = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status });
    }

    // If MFA required, return without setting cookies so frontend can show MFA form
    if (data.mfaRequired) {
      return NextResponse.json({ mfaRequired: true });
    }

    // Guard: accessToken must exist before writing cookies
    if (!data.accessToken) {
      return NextResponse.json(
        { code: 'NO_ACCESS_TOKEN', message: 'Login succeeded but no token received' },
        { status: 500 },
      );
    }

    const setCookieHeader = apiRes.headers.get('set-cookie');
    let refreshToken: string | undefined = undefined;
    if (setCookieHeader) {
      const match = setCookieHeader.match(/cp_rft=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    setSessionCookies(data.accessToken, refreshToken);

    return NextResponse.json({
      accessToken: data.accessToken,
      user: data.user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal BFF login error';
    return NextResponse.json({ code: 'BFF_LOGIN_ERROR', message }, { status: 500 });
  }
}
