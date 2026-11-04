/** Server timestamps are UTC ISO strings; everything here shows/derives LOCAL time. */

/** Minutes ahead of UTC (330 for India). Sent as ?tz_offset_min on reports/export/stats. */
export function tzOffsetMin(date: Date = new Date()): number {
  return -date.getTimezoneOffset();
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function toTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const todayStr = (now: Date = new Date()): string => toDateInput(now);
export const monthStartStr = (now: Date = new Date()): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
export function quarterStartStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(Math.floor(now.getMonth() / 3) * 3 + 1)}-01`;
}

export function validateRange(from: string, to: string): string {
  return from && to && from > to ? `"From" (${from}) is after "To" (${to}).` : '';
}

export function minutesSince(iso: string | null | undefined, nowMs: number = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((nowMs - t) / 60000));
}

/** "< 1m", "47m", "3h 5m", "3h". */
export function elapsedLabel(mins: number): string {
  if (mins < 1) return '< 1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function timeAgo(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return 'never';
  const mins = minutesSince(iso, nowMs);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 60 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return iso ? new Date(iso).toLocaleDateString('en-IN', opts) : '—';
}
export function formatTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
}
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? `${formatDate(iso)}, ${formatTime(iso)}` : '—';
}

export function daysLeft(iso: string | null | undefined, nowMs: number = Date.now()): number | null {
  return iso ? Math.ceil((new Date(iso).getTime() - nowMs) / 86400000) : null;
}

/** Indian financial year label, e.g. "2025-26". */
export function currentFyLabel(now: Date = new Date()): string {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}
export function fyOptions(firstYear: number, now: Date = new Date()): string[] {
  const current = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const out: string[] = [];
  for (let y = current; y >= firstYear; y--) out.push(`${y}-${String(y + 1).slice(2)}`);
  return out;
}

/** "2026-01-05" -> "5 Jan". A calendar date, so the viewer's time zone cannot shift it. */
export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
