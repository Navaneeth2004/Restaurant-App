import { useState } from 'react';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { useCreateParcel } from '../hooks/live/useParcelSlots';

interface Props { onCreated: () => void; onClose: () => void }

export default function ParcelModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { busy, error, create } = useCreateParcel(onCreated, onClose);
  const optional = <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span>;

  return (
    <Modal title="New Parcel / Takeaway">
      <form onSubmit={e => { e.preventDefault(); void create(name, phone); }}>
        <h3 className="font-bold text-white text-base mb-1">New Parcel / Takeaway</h3>
        <p className="text-zinc-500 text-xs mb-4">Creates a temporary slot for a takeaway order — customer name is optional.</p>
        <div className="space-y-3">
          <div><label className="label" htmlFor="parcel-name">Customer Name {optional}</label>
            <input id="parcel-name" className="input" placeholder="e.g. Rahul" value={name} maxLength={60} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div><label className="label" htmlFor="parcel-phone">Phone {optional}</label>
            <input id="parcel-phone" className="input" type="tel" placeholder="e.g. 98765 43210" value={phone} maxLength={20} onChange={e => setPhone(e.target.value)} /></div>
          <ErrorNotice error={error} fallback="Failed to create the parcel slot" />
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-brand flex-1" disabled={busy}>{busy ? <><Spinner />Creating…</> : 'Create Slot'}</button>
        </div>
      </form>
    </Modal>
  );
}
