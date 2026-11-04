import { useState } from 'react';
import { errorMessage } from 'api/errors';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { MIN_PIN_LENGTH, Role } from 'config/constants';
import { pinProblem, ROLE_STYLES } from '../hooks/staff-rules';
import PinFields from './PinFields';

interface Props { busy: boolean; onSave: (f: { name: string; pin: string; role: Role }) => Promise<unknown>; onClose: () => void }

const ORDER: ReadonlyArray<Role> = ['waiter', 'kitchen', 'admin'];

export default function StaffModal({ busy, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('waiter');
  const [error, setError] = useState('');

  const submit = async (): Promise<void> => {
    const problem = !name.trim() ? 'Please enter a name.' : pinProblem(pin, confirm, MIN_PIN_LENGTH);
    if (problem) { setError(problem); return; }
    setError('');
    try { await onSave({ name: name.trim(), pin, role }); onClose(); }
    catch (e) { setError(errorMessage(e, 'Failed to add staff.')); }
  };

  return (
    <Modal title="Add Staff Member" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <h3 className="font-bold text-white text-base mb-4">Add Staff Member</h3>
        <div className="space-y-3">
          <div><label className="label" htmlFor="st-name">Name</label>
            <input id="st-name" className="input" placeholder="e.g. Ali" maxLength={40} value={name} onChange={e => { setName(e.target.value); setError(''); }} autoFocus /></div>
          <PinFields pin={pin} confirm={confirm} pinLabel={`PIN (${MIN_PIN_LENGTH} digits min)`} onPin={v => { setPin(v); setError(''); }} onConfirm={v => { setConfirm(v); setError(''); }} />
          {error && <p role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</p>}
          <div><span className="label">Role</span>
            <div className="grid grid-cols-3 gap-2">
              {ORDER.map(r => (
                <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}
                  className={`py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${role === r ? ROLE_STYLES[r] : 'border-surface-border text-zinc-500 hover:text-white'}`}>{r}</button>
              ))}
            </div></div>
          <div className="rounded-lg bg-surface-raised border border-surface-border p-3 text-xs text-zinc-500 space-y-1">
            <div><span className="text-brand-400">Waiter</span> — takes orders, generates bills</div>
            <div><span className="text-blue-400">Kitchen</span> — sees and manages the kitchen display</div>
            <div><span className="text-red-400">Admin</span> — full access to all screens</div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-brand flex-1" disabled={busy}>{busy ? <Spinner /> : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}
