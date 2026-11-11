import { cookies } from 'next/headers';

const ACCESS_COOKIE_NAME = 'cp_at';
const REFRESH_COOKIE_NAME = 'cp_rft';

const isProduction = process.env.NODE_ENV === 'production';

export function getInternalApiUrl(): string {
  return process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001/api/v1';
}

export function setSessionCookies(accessToken: string, refreshToken?: string) {
  const cookieStore = cookies();

  // Access token cookie (15 minutes)
  cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 mins
  });

  // Refresh token cookie (7 days)
  if (refreshToken) {
    cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }
}

export function clearSessionCookies() {
  const cookieStore = cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
  cookieStore.set(REFRESH_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_COOKIE_NAME)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_COOKIE_NAME)?.value;
}
