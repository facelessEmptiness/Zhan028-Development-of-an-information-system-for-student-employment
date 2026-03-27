const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

let isRefreshing = false;
// Queue of requests waiting for token refresh
let waitQueue: Array<(token: string) => void> = [];

function notifyQueue(newToken: string) {
  waitQueue.forEach(cb => cb(newToken));
  waitQueue = [];
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccess: string = data.access_token;
    const newRefresh: string = data.refresh_token ?? refreshToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
    localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
    return newAccess;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.location.href = '/login';
}

/**
 * Drop-in replacement for fetch() that:
 *  - Adds Authorization: Bearer <token> automatically
 *  - On 401: refreshes the token once, then retries
 *  - On refresh failure: clears session and redirects to /login
 */
export async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status !== 401) return res;

  // 401 — try to refresh
  if (isRefreshing) {
    // Another refresh is already in progress — wait for it
    return new Promise(resolve => {
      waitQueue.push(async (newToken: string) => {
        const retryHeaders = new Headers(init.headers);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        resolve(fetch(input, { ...init, headers: retryHeaders }));
      });
    });
  }

  isRefreshing = true;
  const newToken = await tryRefresh();
  isRefreshing = false;

  if (!newToken) {
    notifyQueue('');
    clearSession();
    // Return the original 401 response so callers don't hang
    return res;
  }

  notifyQueue(newToken);

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  return fetch(input, { ...init, headers: retryHeaders });
}
