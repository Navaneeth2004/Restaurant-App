import { STAFF_SESSION_DAYS } from 'config/constants';
import { STORAGE } from 'config/storage-keys';
import type { AuthUser } from 'types/core/auth';

export interface StoredSession { user: AuthUser; token: string; startedAt: number | null }
export type EndReason = 'expired' | 'other';

/**
 * The server never says why a session ended. The one cause we can know is age: past the server's limit
 * it has expired. Anything else (signed in on another device, PIN or account changed, restore) is "other".
 */
export function endReason(startedAt: number | null, now: number = Date.now()): EndReason {
  return startedAt !== null && now - startedAt > STAFF_SESSION_DAYS * 86_400_000 ? 'expired' : 'other';
}

const isUser = (v: unknown): v is AuthUser => {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  return typeof u.id === 'number' && typeof u.name === 'string' && typeof u.role === 'string';
};

export function readSession(): StoredSession | null {
  try {
    const rawUser = sessionStorage.getItem(STORAGE.staffUser);
    const token = sessionStorage.getItem(STORAGE.staffSession);
    const started = Number(sessionStorage.getItem(STORAGE.staffStartedAt));
    if (!rawUser || !token) return null;
    const user: unknown = JSON.parse(rawUser);
    return isUser(user) ? { user, token, startedAt: Number.isFinite(started) && started > 0 ? started : null } : null;
  } catch { return null; }
}
export function writeSession(s: StoredSession): void {
  try {
    sessionStorage.setItem(STORAGE.staffUser, JSON.stringify(s.user));
    sessionStorage.setItem(STORAGE.staffSession, s.token);
    if (s.startedAt !== null) sessionStorage.setItem(STORAGE.staffStartedAt, String(s.startedAt));
  } catch { /* in-memory session still works for this page */ }
}
export function clearSession(): void {
  try { sessionStorage.removeItem(STORAGE.staffUser); sessionStorage.removeItem(STORAGE.staffSession); sessionStorage.removeItem(STORAGE.staffStartedAt); } catch { /* nothing to clear */ }
}
