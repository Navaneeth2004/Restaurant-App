import type { Limits } from 'types/core/subscription';

const LIMIT_LABELS: ReadonlyArray<readonly [string, string]> = [['max_devices', 'Devices'], ['max_staff', 'Staff accounts'], ['max_tables', 'Tables']];

/** [label, text] for every limit; no value means unlimited. */
export const limitRows = (limits: Limits): Array<readonly [string, string]> =>
  LIMIT_LABELS.map(([key, label]) => { const v = limits[key]; return [label, typeof v === 'number' ? String(v) : 'Unlimited'] as const; });