import { NextRequest, NextResponse } from 'next/server';
import {
  getInternalApiUrl,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
  clearSessionCookies,
} from '../../../lib/bff-cookies';

async function handleProxy(req: NextRequest, { params }: { params: { proxy: string[] } }) {
  try {
    const path = params.proxy.join('/');
    const search = req.nextUrl.search;
    const apiUrl = getInternalApiUrl();
    const targetUrl = `${apiUrl}/${path}${search}`;

    let accessToken = getAccessToken();

    // Attempt request
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      // Do not forward host or cookies to internal service
      if (key !== 'host' && key !== 'cookie' && key !== 'content-length') {
        headers[key] = value;
      }
    });

    if (accessToken) {
      headers['authorization'] = `Bearer ${accessToken}`;
    }

    const contentType = req.headers.get('content-type');
    let body: BodyInit | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (contentType?.includes('application/json')) {
        body = JSON.stringify(await req.json());
        headers['content-type'] = 'application/json';
      } else {
        body = await req.arrayBuffer();
      }
    }

    let upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // If 401 Unauthorized, attempt transparent refresh retry
    if (upstreamRes.status === 401) {
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

          // Retry request with fresh token
          headers['authorization'] = `Bearer ${accessToken}`;
          upstreamRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
          });
        } else {
          clearSessionCookies();
        }
      }
    }

    // Return upstream response
    const resHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
      if (key !== 'set-cookie' && key !== 'content-encoding') {
        resHeaders.set(key, value);
      }
    });

    const resContentType = upstreamRes.headers.get('content-type') || '';
    if (resContentType.includes('application/json')) {
      const data = await upstreamRes.json();
      return NextResponse.json(data, {
        status: upstreamRes.status,
        headers: resHeaders,
      });
    }

    const blob = await upstreamRes.arrayBuffer();
    return new NextResponse(blob, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upstream API Gateway Error';
    return NextResponse.json({ code: 'GATEWAY_ERROR', message }, { status: 502 });
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PATCH = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
