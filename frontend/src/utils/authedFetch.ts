/**
 * utils/authedFetch.ts
 *
 * Single shared helper for making authenticated API requests.
 * Replaces all local copies of getToken / authedFetch / authedJson
 * that were previously duplicated across AdminStaff, AdminMenu,
 * AdminBackup, AdminFloor, LocalBackupSection, GoogleDriveSection,
 * MenuExportImport, and BugReportView.
 *
 * Usage:
 *   import { authedFetch, authedJson, getToken } from '../utils/authedFetch';
 *
 *   const data = await authedJson('/api/settings');
 *   const res  = await authedFetch('/api/export/menu');
 */

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

let _token: string | null = null;

/**
 * Fetches the API token from the server (cached in memory).
 * Call resetTokenCache() if the server restarts and the token changes.
 */
export async function getToken(): Promise<string | null> {
  if (_token !== null) return _token;
  try {
    const res  = await fetch(`${API_BASE}/api/auth/token`);
    const data = await res.json();
    _token = data.token ?? null;
    return _token;
  } catch {
    return null;
  }
}

/**
 * Clears the cached token so the next call re-fetches it from the server.
 * Useful after a server restart where the token may have rotated.
 */
export function resetTokenCache(): void {
  _token = null;
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