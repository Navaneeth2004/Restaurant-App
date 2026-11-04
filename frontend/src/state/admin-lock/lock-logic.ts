export interface AdminLockConfig { enabled: boolean; timeout_mins: number }

export const DEFAULT_LOCK: AdminLockConfig = { enabled: false, timeout_mins: 5 };
export const TIMEOUT_OPTIONS = [
  { mins: 0, label: 'Always ask' },
  { mins: 2, label: '2 minutes' },
  { mins: 5, label: '5 minutes' },
  { mins: 10, label: '10 minutes' },
  { mins: 30, label: '30 minutes' },
] as const;

export function parseLockConfig(raw: string | undefined): AdminLockConfig {
  if (!raw) return DEFAULT_LOCK;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return DEFAULT_LOCK;
    const o = v as Record<string, unknown>;
    return {
      enabled: o.enabled === true,
      timeout_mins: typeof o.timeout_mins === 'number' && o.timeout_mins >= 0 ? o.timeout_mins : DEFAULT_LOCK.timeout_mins,
    };
  } catch { return DEFAULT_LOCK; }
}

/** ONE rule for expiry (used by the auto-lock timer AND by entry checks). timeout 0 = "always ask". */
export function isExpired(unlockedAt: number | null, timeoutMins: number, now: number): boolean {
  if (unlockedAt === null) return true;
  if (timeoutMins <= 0) return true;
  return now - unlockedAt >= timeoutMins * 60_000;
}
