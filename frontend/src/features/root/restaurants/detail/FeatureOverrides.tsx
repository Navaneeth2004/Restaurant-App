import { useEffect, useState } from 'react';
import Spinner from 'components/ui/feedback/Spinner';
import { useFeatureCatalog } from 'features/root/access/hooks/useFeatureCatalog';
import { groupFeatures } from 'lib/access/feature-groups';
import { Choice, choiceOf, toChoices, toOverrides } from 'lib/access/overrides';
import type { RestaurantDetail } from 'types/office/root';
import { Section } from '../../ui/Layout';

const CHOICES: ReadonlyArray<{ key: Choice; label: string }> = [{ key: 'inherit', label: 'Inherit' }, { key: 'on', label: 'On' }, { key: 'off', label: 'Off' }];
const SOURCE = { global: 'global switch', restaurant: 'this restaurant', plan: 'subscription' } as const;

interface Props { detail: RestaurantDetail; busy: boolean; onSave: (features: Record<string, boolean>) => void }

/** Exceptions for THIS restaurant: force a feature on or off whatever its subscription says. */
export default function FeatureOverrides({ detail, busy, onSave }: Props) {
  const catalog = useFeatureCatalog();
  const [choices, setChoices] = useState<Record<string, Choice>>(() => toChoices(detail.feature_overrides));
  useEffect(() => { setChoices(toChoices(detail.feature_overrides)); }, [detail.feature_overrides]);
  const pick = (key: string, choice: Choice): void => setChoices(c => ({ ...c, [key]: choice }));

  return (
    <Section title="Screens & features for this restaurant">
      <p className="text-zinc-500 text-xs mb-3">Inherit follows its subscription ({detail.plan}). On / Off overrides it for this restaurant only. A global switch always wins.</p>
      {catalog.data === null ? <Spinner className="w-4 h-4 border-zinc-700 border-t-brand-500" /> : (
        <div className="space-y-3">
          {groupFeatures(catalog.data.features).map(g => (
            <div key={g.group}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{g.group}</p>
              <ul className="divide-y divide-surface-border/50">
                {g.items.map(f => {
                  const now = detail.features_effective[f.key];
                  return (
                    <li key={f.key} className="flex items-center gap-3 py-1.5 flex-wrap">
                      <span className="text-sm text-zinc-200 flex-1 basis-40">{f.label}</span>
                      {now && <span className={`text-[11px] ${now.on ? 'text-emerald-400' : 'text-red-400'}`}>{now.on ? 'on' : 'off'}{now.source ? ` · ${SOURCE[now.source]}` : ''}</span>}
                      <div role="group" aria-label={`${f.label} setting`} className="flex gap-1">
                        {CHOICES.map(c => (
                          <button key={c.key} type="button" aria-pressed={choiceOf(choices, f.key) === c.key} onClick={() => pick(f.key, c.key)}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold ${choiceOf(choices, f.key) === c.key ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white'}`}>{c.label}</button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-brand btn-sm mt-4" disabled={busy || catalog.data === null} onClick={() => onSave(toOverrides(choices))}>{busy ? <><Spinner />Saving…</> : 'Save feature settings'}</button>
    </Section>
  );
}
