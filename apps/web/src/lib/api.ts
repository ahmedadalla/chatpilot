import { getAccessToken, refreshAccessToken, clearAuth } from './auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.ahmedelnwawy.me'
    : 'http://localhost:3001');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractError(payload: unknown): { message: string; code?: string } {
  if (!payload || typeof payload !== 'object') {
    return { message: 'تعذر إكمال العملية.' };
  }
  const value = payload as { message?: string | string[]; code?: string };
  return {
    message: Array.isArray(value.message)
      ? value.message.join('، ')
      : value.message || 'تعذر إكمال العملية.',
    code: value.code,
  };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry && typeof window !== 'undefined') {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest<T>(path, init, false);
    clearAuth();
  }

  const payload = (await response.json().catch(() => null)) as T | unknown;
  if (!response.ok) {
    const error = extractError(payload);
    throw new ApiError(error.message, response.status, error.code);
  }

  return payload as T;
}

export const apiGet = <T>(path: string) => apiRequest<T>(path);

export const apiPost = <T>(path: string, body?: unknown) =>
  apiRequest<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const apiPatch = <T>(path: string, body: unknown) =>
  apiRequest<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const apiDelete = <T = void>(path: string) =>
  apiRequest<T>(path, { method: 'DELETE' });
