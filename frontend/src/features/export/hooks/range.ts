import { monthStartStr, quarterStartStr, todayStr } from 'lib/format/local-time';

export interface Range { from: string; to: string }
export type Preset = 'month' | 'quarter';

export const PRESETS: ReadonlyArray<{ key: Preset; label: string }> = [{ key: 'month', label: 'This Month' }, { key: 'quarter', label: 'This Quarter' }];

export const presetRange = (preset: Preset, now: Date = new Date()): Range => ({
  from: preset === 'month' ? monthStartStr(now) : quarterStartStr(now), to: todayStr(now),
});

/** Which preset (if any) the typed dates currently equal. Derived, so typing a custom date un-highlights it. */
export function activePreset(range: Range, now: Date = new Date()): Preset | null {
  for (const p of PRESETS) {
    const r = presetRange(p.key, now);
    if (r.from === range.from && r.to === range.to) return p.key;
  }
  return null;
}
