import * as SecureStore from 'expo-secure-store';
import { API_BASE as CONFIG_API_BASE } from '../config';
import { getCached, setCached } from './cache';

export const API_BASE = CONFIG_API_BASE;

let isRefreshing = false;
let pendingQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

function flushQueue(err: any, token: string | null) {
  pendingQueue.forEach(p => (err ? p.reject(err) : p.resolve(token!)));
  pendingQueue = [];
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!refreshToken) throw new Error('no_refresh_token');
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error('refresh_failed');
  const data = await res.json();
  await SecureStore.setItemAsync('access_token', data.access_token);
  if (data.refresh_token) await SecureStore.setItemAsync('refresh_token', data.refresh_token);
  return data.access_token;
}

function buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await SecureStore.getItemAsync('access_token');
  const headers = buildHeaders(token, options.headers as Record<string, string>);
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const cacheKey = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    // Network error — serve from cache for GET requests
    if (isGet) {
      const cached = await getCached(cacheKey);
      if (cached) {
        return new Response(cached, { status: 200, headers: { 'Content-Type': 'application/json', 'X-From-Cache': '1' } });
      }
    }
    throw new Error('network_error');
  }

  // Cache successful GET responses
  if (isGet && response.ok) {
    const clone = response.clone();
    clone.text().then(text => setCached(cacheKey, text)).catch(() => {});
  }

  if (response.status !== 401 || path === '/api/auth/refresh') return response;

  // 401 — need token refresh
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      pendingQueue.push({ resolve, reject });
    }).then(newToken => {
      const retryHeaders = buildHeaders(newToken, options.headers as Record<string, string>);
      return fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
    });
  }

  isRefreshing = true;
  try {
    const newToken = await refreshAccessToken();
    flushQueue(null, newToken);
    const retryHeaders = buildHeaders(newToken, options.headers as Record<string, string>);
    return fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
  } catch (err) {
    flushQueue(err, null);
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
    throw err;
  } finally {
    isRefreshing = false;
  }
}
