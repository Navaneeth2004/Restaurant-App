import { todayStr } from 'lib/format/local-time';
import type { RestaurantDetail, RestaurantPatch, RootConfig } from 'types/office/root';

export interface DetailForm { name: string; plan: string; notes: string; trialEnds: string; limits: Record<string, string> }

/** The editable part of a restaurant as form text. The trial end is shown as the operator's LOCAL calendar date. */
export function toForm(d: RestaurantDetail, config: RootConfig): DetailForm {
  return {
    name: d.name, plan: d.plan, notes: d.notes, trialEnds: d.trial_ends_at ? todayStr(new Date(d.trial_ends_at)) : '',
    limits: Object.fromEntries(config.limit_keys.map(k => [k.key, d.limits_override[k.key] === undefined ? '' : String(d.limits_override[k.key])])),
  };
}

/** Blank limit = "use the plan default" (sent as null). A blank trial date clears it; a date means the END of that local day. */
export function toPatch(f: DetailForm): RestaurantPatch {
  const limits: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(f.limits)) limits[k] = v.trim() === '' ? null : Number(v);
  return { name: f.name, plan: f.plan, notes: f.notes, limits, trial_ends_at: f.trialEnds ? new Date(`${f.trialEnds}T23:59:59`).toISOString() : null };
}

/** A problem with the form, or null (the server checks again). */
export function formProblem(f: DetailForm): string | null {
  if (!f.name.trim()) return 'The name cannot be empty.';
  for (const [k, v] of Object.entries(f.limits)) {
    if (v.trim() !== '' && !(Number.isInteger(Number(v)) && Number(v) >= 0)) return `${k.replace('max_', 'Max ').replace('_', ' ')} must be a whole number (or empty).`;
  }
  return null;
}
