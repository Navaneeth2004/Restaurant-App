import SectionCard from 'components/ui/base/SectionCard';
import Toggle from 'components/ui/base/Toggle';
import { LIMITS } from 'config/constants';
import { INDIAN_STATES } from 'config/indian-states';
import type { SettingsFormState } from '../../hooks/useSettingsForm';
import Field from '../Field';

export default function GstSection({ s }: { s: SettingsFormState }) {
  const { form, set } = s;
  const b2b = form.b2b_enabled === 'true';
  const state = INDIAN_STATES.find(x => x.name === form.state_name);
  return (
    <SectionCard title="GST Registration" badge={form.gstin.trim() ? 'Registered' : 'Optional'}
      desc="Only needed if you're GST-registered. Used to generate GSTR-1 and GSTR-3B filings in Export. Leave blank otherwise.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="GSTIN" htmlFor="rs-gstin" hint="15-character GST Identification Number">
          <input id="rs-gstin" className="input font-mono uppercase" placeholder="22AAAAA0000A1Z5" maxLength={LIMITS.gstin} value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} /></Field>
        <Field label="Legal Business Name" htmlFor="rs-legal" hint="Exact name on your GST certificate">
          <input id="rs-legal" className="input" placeholder="As per GST registration" maxLength={LIMITS.legalName} value={form.legal_name} onChange={e => set('legal_name', e.target.value)} /></Field>
        <Field label="State / Place of Supply" htmlFor="rs-state" hint={`State code ${state?.code ?? '—'} — used in the GSTR-1 JSON`}>
          <select id="rs-state" className="input" value={form.state_name} onChange={e => set('state_name', e.target.value)}>{INDIAN_STATES.map(x => <option key={x.code} value={x.name}>{x.name} ({x.code})</option>)}</select></Field>
        <Field label="SAC Code" htmlFor="rs-sac" hint="9963 = Restaurant services (default)">
          <input id="rs-sac" className="input font-mono" inputMode="numeric" placeholder="9963" maxLength={LIMITS.sacCode} value={form.sac_code} onChange={e => set('sac_code', e.target.value.replace(/\D/g, '').slice(0, LIMITS.sacCode))} /></Field>
      </div>
      <div className="mt-4 pt-4 border-t border-surface-border flex items-start gap-3">
        <Toggle enabled={b2b} label="Enable B2B invoicing" onChange={() => set('b2b_enabled', b2b ? 'false' : 'true')} />
        <div>
          <span className="text-sm font-medium text-white">Enable B2B Invoicing</span>
          <p className="text-zinc-600 text-xs leading-relaxed mt-0.5">Adds a "Customer GSTIN" field at payment time. Filled invoices go into the B2B section of GSTR-1 instead of the B2CS aggregate. Leave off for 100% walk-in customers.</p>
        </div>
      </div>
    </SectionCard>
  );
}
