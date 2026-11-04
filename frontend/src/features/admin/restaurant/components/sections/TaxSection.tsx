import Icon from 'components/ui/base/Icon';
import SectionCard from 'components/ui/base/SectionCard';
import { LIMITS } from 'config/constants';
import { clampField } from '../../hooks/settings-form';
import type { SettingsFormState } from '../../hooks/useSettingsForm';
import Field from '../Field';

export default function TaxSection({ s }: { s: SettingsFormState }) {
  const { form, set } = s;
  return (
    <SectionCard title="Currency & Tax" desc="Controls every bill total, report figure, and tax filing export in this app.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Currency Symbol" htmlFor="rs-cur"><input id="rs-cur" className="input" maxLength={LIMITS.currencySymbol} value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} /></Field>
        <Field label="Tax % (GST)" htmlFor="rs-tax">
          <div className="relative">
            <input id="rs-tax" className="input pr-9 font-mono" type="number" min={LIMITS.taxMin} max={LIMITS.taxMax} step="0.5" value={form.tax_percent}
              onChange={e => { const v = clampField(e.target.value, LIMITS.taxMin, LIMITS.taxMax); if (v !== null) set('tax_percent', v); }} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">%</span>
          </div>
        </Field>
      </div>
      <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-brand-500/8 border border-brand-500/20">
        <Icon name="info" className="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-zinc-400 text-[11px] leading-snug"><span className="text-zinc-300 font-medium">Most standalone restaurants: 5%.</span> Restaurants inside hotels with high room tariffs, or outdoor caterers, are usually 18%. Check with your CA if you're unsure — this number also generates your GST filings.</p>
      </div>
    </SectionCard>
  );
}
