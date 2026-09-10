/**
 * utils/authedFetch.ts
 *
 * Single shared source of truth for the API auth token. Every other file
 * that previously did its own token fetch/cache (services/api.ts,
 * AuthContext.tsx, LoginScreen.tsx, AdminLockContext.tsx, BugReportView.tsx,
 * AdminCategories.tsx, AdminFloor.tsx, ExportView.tsx) now imports getToken
 * from here instead.
 *
 * FIX (two real caching bugs):
 * 1. The old cache used `_token: string | null`, checked with
 *    `if (_token !== null) return _token`. When auth is DISABLED
 *    server-side, /api/auth/token legitimately returns { token: null },
 *    which that check treated as "not fetched yet" — so every single
 *    request re-fetched the token forever in that deployment mode.
 * 2. services/api.ts's version of this seeded the failure/disabled case
 *    with '' instead of null, avoiding bug #1, but introducing a worse
 *    one: if the very FIRST call to /api/auth/token failed for any
 *    transient network reason, the catch set the cache to '' and the
 *    `!== null` guard treated that as "already fetched" forever — every
 *    subsequent API call went out unauthenticated and got 401'd for the
 *    rest of the page's life, with no retry, requiring a full reload.
 *
 * Fix: use a proper tri-state cache.
 *   - `undefined` = never successfully resolved yet → always fetch.
 *   - `null`      = server explicitly confirmed auth is disabled
 *                    (response included `disabled: true`) → safe to
 *                    cache forever, this is a real, stable answer.
 *   - a string    = the real token → cache forever.
 * A network/parse failure is NEVER cached — it always retries on the
 * next call, so a transient blip can't permanently break auth for the
 * rest of the session.
 *
 * Usage:
 *   import { authedFetch, authedJson, getToken, resetTokenCache } from '../utils/authedFetch';
 *
 *   const data = await authedJson('/api/settings');
 *   const res  = await authedFetch('/api/export/menu');
 */

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

let _token: string | null | undefined = undefined; // undefined = not yet resolved
let _authDisabled = false;

/**
 * Fetches the API token (cached in memory). Safe to call from anywhere —
 * concurrent callers before the first resolution will each trigger their
 * own fetch (acceptable; this endpoint is cheap and unauthenticated), but
 * once any call succeeds, all subsequent calls return instantly from cache.
 */
export async function getToken(): Promise<string | null> {
  if (_authDisabled) return null;
  if (_token !== undefined) return _token;

  try {
    const res  = await fetch(`${API_BASE}/api/auth/token`);
    const data = await res.json();

    if (data?.disabled) {
      _authDisabled = true;
      _token = null;
      return null;
    }

    _token = data?.token ?? null;
    return _token;
  } catch {
    // FIX: do NOT cache a failure — leave _token as undefined so the
    // next call retries instead of permanently going unauthenticated.
    return null;
  }
}

/**
 * Clears the cached token/disabled-state so the next call re-fetches from
 * the server. Useful after a server restart where the token may have
 * rotated, or if auth gets re-enabled without a full page reload.
 */
export function resetTokenCache(): void {
  _token = undefined;
  _authDisabled = false;
}

/**
 * fetch() wrapper that automatically injects the Authorization header.
 * Merges any headers you pass in with the auth header.
 */
export async function authedFetch(
  url: string,
  opts: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

/**
 * Like authedFetch but:
 *   - Sets Content-Type: application/json automatically
 *   - Parses the response as JSON
 *   - Throws with the server error message if response is not ok
 */
export async function authedJson<T = any>(
  url: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}