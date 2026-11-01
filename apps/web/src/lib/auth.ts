import type { LoginDto, LoginResponse, RefreshTokenResponse } from '@chatpilot/contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://api.ahmedelnwawy.me' : 'http://localhost:3001');

const ACCESS_TOKEN_KEY = 'chatpilot.access-token';
const USER_KEY = 'chatpilot.user';

export type AuthUser = LoginResponse['user'];

export function getApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const rawUser = window.localStorage.getItem(USER_KEY);
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearAuth();
    return null;
  }
}

export function storeAuth(result: LoginResponse) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function login(credentials: LoginDto) {
  const response = await fetch(getApiUrl('/api/v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  const payload = (await response.json().catch(() => null)) as
    | LoginResponse
    | { message?: string | string[] }
    | null;
  if (!response.ok) {
    const message = payload && 'message' in payload
      ? Array.isArray(payload.message) ? payload.message.join(', ') : payload.message
      : undefined;
    throw new Error(message || 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.');
  }
  storeAuth(payload as LoginResponse);
  return payload as LoginResponse;
}

export async function refreshAccessToken() {
  const response = await fetch(getApiUrl('/api/v1/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    clearAuth();
    return null;
  }
  const payload = (await response.json()) as RefreshTokenResponse;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  return payload.accessToken;
}

export async function logout() {
  const token = getAccessToken();
  if (token) {
    await fetch(getApiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    }).catch(() => undefined);
  }
  clearAuth();
}
