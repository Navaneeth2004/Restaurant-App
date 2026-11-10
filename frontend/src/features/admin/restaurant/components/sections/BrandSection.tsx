import SectionCard from 'components/ui/base/SectionCard';
import { BRAND_PRESETS } from 'config/constants';
import { isHexColor } from 'lib/browser/color';
import { useObjectUrl } from 'hooks/browser/useObjectUrl';
import type { SettingsFormState } from '../../hooks/useSettingsForm';
import BrandPreview from './BrandPreview';

export default function BrandSection({ s }: { s: SettingsFormState }) {
  const { form, set } = s;
  const valid = isHexColor(form.brand_color);
  const color = valid ? form.brand_color : '#f97316';
  const picked = useObjectUrl(s.logo);
  const logo = picked ?? (!s.removeLogo && s.currentLogoUrl ? s.currentLogoUrl : null);
  return (
    <SectionCard title="Brand Color" desc="Changes the header, buttons, and accents across every screen.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap p-1">
            {BRAND_PRESETS.map(c => (
              <button key={c} type="button" aria-label={`Use ${c}`} aria-pressed={color === c} onClick={() => set('brand_color', c)} style={{ background: c }}
                className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-card scale-110' : ''}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Pick a colour" value={color} onChange={e => set('brand_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0" style={{ colorScheme: 'dark' }} />
            <input aria-label="Colour code" className={`input py-2 text-xs font-mono max-w-[200px] ${valid ? '' : 'border-red-500/60'}`} placeholder="#f97316" maxLength={7} value={form.brand_color} onChange={e => set('brand_color', e.target.value)} />
          </div>
          {!valid && <p role="alert" className="text-red-400 text-[11px]">Use a 6-digit colour such as #f97316.</p>}
        </div>
        <BrandPreview color={color} name={form.restaurant_name} logo={logo} />
      </div>
    </SectionCard>
  );
}
