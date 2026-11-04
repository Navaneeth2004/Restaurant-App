import { useState } from 'react';
import { errorMessage } from 'api/errors';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { MIN_PIN_LENGTH } from 'config/constants';
import type { Staff } from 'types/core/auth';
import { pinProblem } from '../hooks/staff-rules';
import PinFields from './PinFields';

interface Props { staff: Staff; busy: boolean; onSave: (pin: string) => Promise<unknown>; onClose: () => void }

export default function ChangePinModal({ staff, busy, onSave, onClose }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (): Promise<void> => {
    const problem = pinProblem(pin, confirm, MIN_PIN_LENGTH);
    if (problem) { setError(problem); return; }
    try { await onSave(pin); onClose(); }
    catch (e) { setError(errorMessage(e, 'Failed to update the PIN.')); }
  };

  return (
    <Modal title="Change PIN" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <h3 className="font-bold text-white text-base mb-1">Change PIN</h3>
        <p className="text-zinc-500 text-xs mb-4">Setting a new PIN for <span className="text-white font-medium">{staff.name}</span></p>
        <div className="space-y-3">
          <PinFields pin={pin} confirm={confirm} pinLabel="New PIN (4–6 digits)" autoFocus onPin={v => { setPin(v); setError(''); }} onConfirm={v => { setConfirm(v); setError(''); }} />
          {error && <p role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-brand flex-1" disabled={busy || pin.length < MIN_PIN_LENGTH || confirm.length < MIN_PIN_LENGTH}>{busy ? <Spinner /> : 'Save PIN'}</button>
        </div>
      </form>
    </Modal>
  );
}
