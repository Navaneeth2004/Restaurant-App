import { useCallback, useMemo, useState } from 'react';
import { updateSettings, uploadLogo } from 'api/restaurant/settings.api';
import { useToastAction } from 'hooks/async/useToastAction';
import { useSettingsState } from 'state/settings/useSettings';
import { fromSettings, FormKey, FormShape, toPatch, validateSettings } from './settings-form';

/**
 * The form is "server values + the fields the user changed". Nothing is copied into state on load, so a settings
 * update from another device shows up immediately in untouched fields and never overwrites what is being typed.
 */
export function useSettingsForm() {
  const { settings, refresh } = useSettingsState();
  const base = useMemo(() => fromSettings(settings), [settings]);
  const [edits, setEdits] = useState<Partial<FormShape>>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const { busy, run } = useToastAction();

  const form = useMemo<FormShape>(() => ({ ...base, ...edits }), [base, edits]);
  const set = useCallback((key: FormKey, value: string) => setEdits(e => ({ ...e, [key]: value })), []);
  const changedKeys = (Object.keys(edits) as FormKey[]).filter(k => edits[k] !== base[k]);
  const dirty = changedKeys.length > 0 || logo !== null || removeLogo;
  const problem = validateSettings(form);

  const pickLogo = useCallback((f: File | null) => { setLogo(f); if (f) setRemoveLogo(false); }, []);
  const dropLogo = useCallback(() => { setLogo(null); setRemoveLogo(true); }, []);

  const save = useCallback(() => run(async () => {
    let logoUrl = settings.logo_url ?? '';
    if (logo) logoUrl = (await uploadLogo(logo)).logo_url;
    else if (removeLogo) logoUrl = '';
    await updateSettings({ ...toPatch(form), logo_url: logoUrl });
    setEdits({}); setLogo(null); setRemoveLogo(false);
    refresh();
  }, { success: 'Settings saved', failure: 'Failed to save the settings' }), [run, settings.logo_url, logo, removeLogo, form, refresh]);

  return { form, set, dirty, problem, busy, save, logo, removeLogo, pickLogo, dropLogo, currentLogoUrl: settings.logo_url ?? '' };
}

export type SettingsFormState = ReturnType<typeof useSettingsForm>;
