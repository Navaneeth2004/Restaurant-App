import { useRef } from 'react';
import Icon from 'components/ui/base/Icon';
import { API_ORIGIN } from 'config/env';
import { useObjectUrl } from 'hooks/browser/useObjectUrl';
import type { SettingsFormState } from '../../hooks/useSettingsForm';

export default function LogoPicker({ s }: { s: SettingsFormState }) {
  const ref = useRef<HTMLInputElement>(null);
  const picked = useObjectUrl(s.logo);
  const preview = picked ?? (!s.removeLogo && s.currentLogoUrl ? `${API_ORIGIN}${s.currentLogoUrl}` : null);
  return (
    <div className="flex flex-col items-center gap-2 lg:w-28">
      <button type="button" aria-label="Choose logo" onClick={() => ref.current?.click()}
        className="w-24 h-24 rounded-xl border-2 border-dashed border-surface-border bg-surface-raised flex items-center justify-center hover:border-brand-500/50 overflow-hidden transition-colors">
        {preview ? <img src={preview} alt="Logo" className="w-full h-full object-cover" /> : <Icon name="image" className="w-7 h-7 text-zinc-600" strokeWidth={1.5} />}
      </button>
      <div className="flex flex-col gap-1.5 w-full">
        <button type="button" className="btn btn-sm text-[11px] w-full" onClick={() => ref.current?.click()}>{preview ? 'Change' : 'Upload logo'}</button>
        {preview && <button type="button" className="btn btn-sm btn-danger text-[11px] w-full" onClick={() => { s.dropLogo(); if (ref.current) ref.current.value = ''; }}>Remove</button>}
      </div>
      <input ref={ref} type="file" accept="image/*" aria-label="Logo file" className="hidden" onChange={e => s.pickLogo(e.target.files?.[0] ?? null)} />
      {s.logo && <p className="text-amber-400 text-[10px] text-center leading-snug">Save to apply</p>}
    </div>
  );
}
