import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useAuth } from 'state/auth/useAuth';
import type { Staff } from 'types/core/auth';
import { deleteBlocker } from '../hooks/staff-rules';
import { useStaff } from '../hooks/useStaff';
import ChangePinModal from './ChangePinModal';
import StaffColumn from './StaffColumn';
import StaffModal from './StaffModal';

const ROLE_ORDER = ['admin', 'kitchen', 'waiter'] as const;

export default function StaffPanel() {
  const s = useStaff();
  const { user } = useAuth();
  const { requirePin } = useAdminLock();
  const confirm = useConfirmAction();
  const [adding, setAdding] = useState(false);
  const [pinFor, setPinFor] = useState<Staff | null>(null);

  const askDelete = (m: Staff): void => requirePin(() => confirm.ask({
    title: 'Remove Staff Member', message: `Remove ${m.name} from staff? This cannot be undone.`, confirmLabel: 'Remove', danger: true,
    action: () => s.remove(m.id),
  }), 'Remove Staff Member', 'Enter admin PIN to remove staff');

  return (
    <div>
      {confirm.dialog && <ConfirmDialog {...confirm.dialog} />}
      {adding && <StaffModal busy={s.saving} onSave={s.add} onClose={() => setAdding(false)} />}
      {pinFor && <ChangePinModal staff={pinFor} busy={s.saving} onSave={pin => s.setPin(pinFor.id, pinFor.name, pin)} onClose={() => setPinFor(null)} />}
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-bold text-white text-sm">Staff</h3>
        <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{s.staff.length} members</span>
        <button type="button" className="btn btn-brand btn-sm ml-auto" onClick={() => setAdding(true)}>+ Add Staff</button>
      </div>
      {s.loading && <PageSpinner />}
      <ErrorNotice error={s.error} onRetry={s.reload} fallback="Could not load staff" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ROLE_ORDER.map(role => (
          <StaffColumn key={role} role={role} members={s.staff.filter(m => m.role === role)} blocker={m => deleteBlocker(m, user?.id, s.staff)} onPin={setPinFor} onDelete={askDelete} />
        ))}
      </div>
      <details className="mt-5 group">
        <summary className="text-zinc-600 text-xs cursor-pointer hover:text-zinc-400 transition-colors select-none">Forgot your admin PIN?</summary>
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-zinc-500 text-xs leading-relaxed">
          Another admin can set a new PIN for you here (the key icon). If you are the only admin, ask the restaurant owner to reset it, or contact support.
        </p>
      </details>
    </div>
  );
}
