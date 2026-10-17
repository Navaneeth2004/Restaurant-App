/** Small helpers for the root console. The login is an httpOnly cookie that is only sent to /api/root/*. */
const API = process.env.REACT_APP_API_URL || window.location.origin;

export async function rootCall<T = any>(path: string, method = 'GET', body?: object): Promise<T> {
  const res = await fetch(`${API}/api/root${path}`, {
    method, credentials: 'include', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    window.dispatchEvent(new Event('root-auth-lost'));
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error((data as any).error || `Error ${res.status}`);
  return data as T;
}

export const rootUrl = (path: string) => `${API}/api/root${path}`;

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 60 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

export function bytes(n: number | null | undefined): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}