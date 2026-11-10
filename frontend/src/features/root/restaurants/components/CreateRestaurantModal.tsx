import { FormEvent, useState } from 'react';
import { createRestaurant } from 'api/platform/root.api';
import { errorMessage } from 'api/errors';
import ChoicePills from 'components/ui/base/ChoicePills';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { useBusy } from 'hooks/async/useBusy';
import type { CreatedRestaurant, NewRestaurantInput, RootConfig } from 'types/office/root';
import { Field, KV } from '../../ui/Layout';

interface Props { config: RootConfig; onClose: () => void; onCreated: () => void }
const BLANK: NewRestaurantInput = { restaurant_name: '', owner_phone: '', owner_password: '', admin_name: '', admin_pin: '', plan: 'trial', trial_days: '30', notes: '' };

export default function CreateRestaurantModal({ config, onClose, onCreated }: Props) {
  const [f, setF] = useState<NewRestaurantInput>(BLANK);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreatedRestaurant | null>(null);
  const [busy, run] = useBusy();
  const set = (k: keyof NewRestaurantInput, v: string): void => setF(p => ({ ...p, [k]: v }));

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setError('');
    void run(async () => { try { setResult(await createRestaurant(f)); onCreated(); } catch (err) { setError(errorMessage(err, 'Could not create the restaurant')); } });
  };

  if (result) {
    return (
      <Modal title="Restaurant created" className="max-w-md" sheet showClose onClose={onClose}>
        <h3 className="font-bold text-white text-base mb-1 pr-10">Restaurant created</h3>
        <p className="text-zinc-400 text-xs mb-3">Save these now — generated values are shown only once.</p>
        <KV rows={[['Restaurant', result.name], ['Owner phone', result.owner_phone], ['Owner password', result.temp_owner_password ?? '(the one you typed, or the existing account)'], ['Admin PIN', result.admin_pin ?? '(the one you typed)']]} />
        <button type="button" className="btn btn-brand w-full mt-4" onClick={onClose}>Done</button>
      </Modal>
    );
  }
  return (
    <Modal title="New restaurant" className="max-w-md" sheet showClose onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-bold text-white text-base pr-10">New restaurant</h3>
        <Field label="Restaurant name" htmlFor="nr-name"><input id="nr-name" className="input" value={f.restaurant_name} onChange={e => set('restaurant_name', e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Owner phone" htmlFor="nr-phone"><input id="nr-phone" className="input" type="tel" value={f.owner_phone} onChange={e => set('owner_phone', e.target.value)} /></Field>
          <Field label="Owner password" htmlFor="nr-pass" hint="Empty = generate one (new owners only)"><input id="nr-pass" className="input" value={f.owner_password} onChange={e => set('owner_password', e.target.value)} /></Field>
          <Field label="Admin's name" htmlFor="nr-admin"><input id="nr-admin" className="input" placeholder="Admin" value={f.admin_name} onChange={e => set('admin_name', e.target.value)} /></Field>
          <Field label="Admin PIN" htmlFor="nr-pin" hint="Empty = generate"><input id="nr-pin" className="input font-mono" inputMode="numeric" maxLength={6} value={f.admin_pin} onChange={e => set('admin_pin', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Trial days" htmlFor="nr-days" hint="Only used for the trial plan"><input id="nr-days" className="input" type="number" min={0} value={f.trial_days} onChange={e => set('trial_days', e.target.value)} /></Field>
        </div>
        <Field label="Plan" htmlFor="nr-plan"><ChoicePills label="Plan" options={config.plans.map(p => ({ value: p, label: p }))} value={f.plan} onChange={v => set('plan', v)} /></Field>
        <Field label="Private notes" htmlFor="nr-notes"><textarea id="nr-notes" className="input resize-none" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        {error && <div role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
        <button type="submit" className="btn btn-brand w-full" disabled={busy || !f.restaurant_name.trim() || !f.owner_phone.trim()}>{busy ? <><Spinner />Creating…</> : 'Create restaurant'}</button>
      </form>
    </Modal>
  );
}
