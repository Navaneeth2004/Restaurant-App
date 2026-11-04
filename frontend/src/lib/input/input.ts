export const digitsOnly = (v: string, max?: number): string => {
  const d = v.replace(/\D/g, '');
  return max === undefined ? d : d.slice(0, max);
};

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Parses a numeric text input; returns null when empty or not a number. */
export function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
