export interface FeatureGroup<T extends { group: string }> { group: string; items: T[] }

/** Features grouped by their `group`, in the order the groups first appear. */
export function groupFeatures<T extends { group: string }>(features: ReadonlyArray<T>): FeatureGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const f of features) {
    const list = map.get(f.group);
    if (list) list.push(f); else map.set(f.group, [f]);
  }
  return Array.from(map, ([group, items]) => ({ group, items }));
}

/** `disabled` is the list of switched-OFF keys. These return a new list and never change the input. */
export const setFeatureOn = (disabled: ReadonlyArray<string>, key: string, on: boolean): string[] =>
  (on ? disabled.filter(k => k !== key) : disabled.includes(key) ? [...disabled] : [...disabled, key]);

export const setGroupOn = (disabled: ReadonlyArray<string>, keys: ReadonlyArray<string>, on: boolean): string[] =>
  (on ? disabled.filter(k => !keys.includes(k)) : [...disabled, ...keys.filter(k => !disabled.includes(k))]);
