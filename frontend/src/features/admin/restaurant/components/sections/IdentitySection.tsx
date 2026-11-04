import SectionCard from 'components/ui/base/SectionCard';
import { LIMITS } from 'config/constants';
import type { SettingsFormState } from '../../hooks/useSettingsForm';
import Field from '../Field';
import LogoPicker from './LogoPicker';

export default function IdentitySection({ s }: { s: SettingsFormState }) {
  const { form, set } = s;
  return (
    <SectionCard title="Restaurant Identity" desc="Shown on bills, the navigation bar, and the login screen.">
      <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-5">
        <LogoPicker s={s} />
        <div className="space-y-3 min-w-0">
          <Field label="Restaurant Name" htmlFor="rs-name"><input id="rs-name" className="input" placeholder="ABC Restaurant" maxLength={LIMITS.restaurantName} value={form.restaurant_name} onChange={e => set('restaurant_name', e.target.value)} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone Number" htmlFor="rs-phone"><input id="rs-phone" className="input" type="tel" placeholder="+91 98765 43210" maxLength={LIMITS.phone} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Address" htmlFor="rs-addr"><input id="rs-addr" className="input" placeholder="123 Main Street" maxLength={LIMITS.address} value={form.address} onChange={e => set('address', e.target.value)} /></Field>
          </div>
          <Field label="Bill Footer" htmlFor="rs-foot"><input id="rs-foot" className="input" placeholder="Thank you for dining with us!" maxLength={LIMITS.billFooter} value={form.bill_footer} onChange={e => set('bill_footer', e.target.value)} /></Field>
        </div>
      </div>
    </SectionCard>
  );
}
