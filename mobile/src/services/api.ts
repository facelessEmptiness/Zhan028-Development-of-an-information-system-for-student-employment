import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'http://192.168.1.18:8000';

let isRefreshing = false;
let pendingQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

function flushQueue(err: any, token: string | null) {
  pendingQueue.forEach(p => (err ? p.reject(err) : p.resolve(token!)));
  pendingQueue = [];
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('no_refresh_token');
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error('refresh_failed');
  const data = await res.json();
  await AsyncStorage.setItem('access_token', data.access_token);
  if (data.refresh_token) await AsyncStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

function buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await AsyncStorage.getItem('access_token');
  const headers = buildHeaders(token, options.headers as Record<string, string>);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

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
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    throw err;
  } finally {
    isRefreshing = false;
  }
}
