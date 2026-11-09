import type { Subscription, SubscriptionInput } from 'types/office/root';

/** The editable part of a subscription as form text. A blank limit means unlimited. */
export interface SubForm { name: string; description: string; limits: Record<string, string>; disabled: string[] }

const limitText = (limits: Readonly<Record<string, number>>, key: string): string => (limits[key] === undefined ? '' : String(limits[key]));

export const emptyForm = (limitKeys: ReadonlyArray<{ key: string }>): SubForm =>
  ({ name: '', description: '', limits: Object.fromEntries(limitKeys.map(k => [k.key, ''])), disabled: [] });

/** `copy` = start a new subscription from an existing one ("Copy of …"). */
export const toForm = (sub: Subscription, limitKeys: ReadonlyArray<{ key: string }>, copy = false): SubForm => ({
  name: copy ? `Copy of ${sub.name}` : sub.name, description: sub.description,
  limits: Object.fromEntries(limitKeys.map(k => [k.key, limitText(sub.limits, k.key)])), disabled: [...sub.disabled],
});

export function toInput(f: SubForm): SubscriptionInput {
  const limits: Record<string, number | null> = {};
  for (const [key, text] of Object.entries(f.limits)) limits[key] = text.trim() === '' ? null : Number(text);
  return { name: f.name.trim(), description: f.description.trim(), limits, disabled: f.disabled };
}

/** A problem with the form, or null (the server checks again). */
export function formProblem(f: SubForm): string | null {
  if (!f.name.trim()) return 'Give the subscription a name.';
  for (const text of Object.values(f.limits)) {
    if (text.trim() !== '' && !(Number.isInteger(Number(text)) && Number(text) >= 0)) return 'Limits must be whole numbers (or empty for unlimited).';
  }
  return null;
}
