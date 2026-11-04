import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import Spinner from 'components/ui/feedback/Spinner';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import type { Device } from 'types/core/auth';
import { useDevices } from '../hooks/useDevices';
import DeviceRow from './DeviceRow';
import PairingCard from './PairingCard';

const ROLE_OPTIONS = [
  { key: '', label: 'Any staff', hint: 'Waiters, kitchen and admins can all log in' },
  { key: 'waiter', label: 'Waiter only', hint: 'Only waiter and admin PINs work' },
  { key: 'kitchen', label: 'Kitchen only', hint: 'Only kitchen and admin PINs work' },
] as const;

export default function DevicesPanel() {
  const d = useDevices();
  const { requirePin } = useAdminLock();
  const confirm = useConfirmAction();
  const [role, setRole] = useState<string>('');

  const askRemove = (dev: Device): void => confirm.ask({
    title: dev.is_current ? 'Remove THIS device?' : 'Remove this device?',
    message: dev.is_current ? 'You will be disconnected and will need the owner password or a pairing code to connect again.'
      : `“${dev.name}” is disconnected immediately and will need a new pairing code to get back in.`,
    confirmLabel: 'Remove', danger: true, action: () => d.remove(dev),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      {confirm.dialog && <ConfirmDialog {...confirm.dialog} />}
      <div>
        <h3 className="font-bold text-white text-sm">Linked devices</h3>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">Only linked devices can open this restaurant, and every person still signs in with their own PIN. To add a staff phone, create a code here and type it on that phone (or scan the QR). Remove a device the moment it is lost or someone leaves.</p>
      </div>
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest mb-3">Add a device</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {ROLE_OPTIONS.map(o => (
            <button key={o.key} type="button" aria-pressed={role === o.key} onClick={() => setRole(o.key)}
              className={`text-left p-3 rounded-lg border transition-all ${role === o.key ? 'bg-brand-500/10 border-brand-500/50' : 'border-surface-border hover:border-zinc-600'}`}>
              <p className={`text-xs font-bold ${role === o.key ? 'text-brand-400' : 'text-white'}`}>{o.label}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug">{o.hint}</p>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-brand" disabled={d.busy} onClick={() => requirePin(() => { void d.createCode(role || null); }, 'Add a device', 'Enter admin PIN to create a pairing code')}>
          {d.busy ? <><Spinner />Creating…</> : 'Create pairing code'}
        </button>
        {d.pairing && <PairingCard pairing={d.pairing} secondsLeft={d.secondsLeft} />}
      </div>
      <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest">{d.loading ? 'Devices' : `${d.devices.length} device${d.devices.length !== 1 ? 's' : ''}`}</h4>
          <button type="button" className="btn btn-sm" onClick={d.reload}>Refresh</button>
        </div>
        {d.loading && <PageSpinner />}
        <div className="px-4 pt-3 empty:hidden"><ErrorNotice error={d.error} onRetry={d.reload} fallback="Could not load devices" /></div>
        <div className="divide-y divide-surface-border">{d.devices.map(dev => <DeviceRow key={dev.id} device={dev} onRemove={askRemove} />)}</div>
      </div>
    </div>
  );
}
