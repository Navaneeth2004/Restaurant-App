/** A restaurant's choice for one feature: follow its subscription, or force it on / off. */
export type Choice = 'inherit' | 'on' | 'off';

export const toChoices = (overrides: Readonly<Record<string, boolean>>): Record<string, Choice> =>
  Object.fromEntries(Object.entries(overrides).map(([key, on]): [string, Choice] => [key, on ? 'on' : 'off']));

export const choiceOf = (choices: Readonly<Record<string, Choice>>, key: string): Choice => choices[key] ?? 'inherit';

/** What is sent to the server: only the features that are forced on or off. */
export function toOverrides(choices: Readonly<Record<string, Choice>>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, choice] of Object.entries(choices)) if (choice !== 'inherit') out[key] = choice === 'on';
  return out;
}
