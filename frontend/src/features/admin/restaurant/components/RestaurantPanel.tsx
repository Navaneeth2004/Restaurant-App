import Spinner from 'components/ui/feedback/Spinner';
import { useSettingsForm } from '../hooks/useSettingsForm';
import BrandSection from './sections/BrandSection';
import GstSection from './sections/GstSection';
import IdentitySection from './sections/IdentitySection';
import LockSettings from './sections/LockSettings';
import OverdueSection from './sections/OverdueSection';
import TaxSection from './sections/TaxSection';

export default function RestaurantPanel() {
  const s = useSettingsForm();
  return (
    <form className="space-y-5 pb-2" onSubmit={e => { e.preventDefault(); if (s.dirty && !s.problem) void s.save(); }}>
      <IdentitySection s={s} />
      <TaxSection s={s} />
      <GstSection s={s} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><BrandSection s={s} /><OverdueSection s={s} /></div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-t border-surface-border">
        <button type="submit" className="btn btn-brand w-full sm:w-auto px-6 py-2.5 text-sm font-semibold" disabled={s.busy || !s.dirty || s.problem !== null}>
          {s.busy ? <><Spinner />Saving…</> : 'Save Settings'}
        </button>
        {s.problem && s.dirty ? <span role="alert" className="text-red-400 text-xs">{s.problem}</span>
          : <span className="text-zinc-600 text-xs">Saves everything above, including GST and branding</span>}
      </div>
      <LockSettings />
    </form>
  );
}
