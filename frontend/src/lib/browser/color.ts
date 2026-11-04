const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

export const DEFAULT_BRAND = '#f97316';

export const isHexColor = (v: string): boolean => HEX6.test(v) || HEX3.test(v);

/** Returns a safe 6-digit lowercase hex, or the fallback. Never returns user text unvalidated. */
export function safeHex(v: string | null | undefined, fallback: string = DEFAULT_BRAND): string {
  if (!v) return fallback;
  if (HEX6.test(v)) return v.toLowerCase();
  if (HEX3.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  return fallback;
}

/** pct > 0 lightens, pct < 0 darkens. */
export function shade(hex: string, pct: number): string {
  const n = parseInt(safeHex(hex).slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c =>
    pct > 0 ? Math.min(255, Math.round(c + (255 - c) * pct / 100)) : Math.max(0, Math.round(c * (1 + pct / 100))),
  );
  return `#${ch.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}
