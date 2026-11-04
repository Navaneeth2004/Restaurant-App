import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import FactoryResetModal from './FactoryResetModal';

export default function DangerZone({ onHide }: { onHide: () => void }) {
  const { requirePin } = useAdminLock();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <Icon name="warning" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1"><p className="text-red-400 text-xs font-semibold">Danger Zone</p>
          <p className="text-zinc-600 text-xs mt-0.5 leading-relaxed">Factory reset wipes order history, photos, the menu, tables and settings. Staff accounts are kept. Take a backup first.</p></div>
        <button type="button" className="text-zinc-600 hover:text-zinc-400 text-xs flex-shrink-0" onClick={onHide}>Hide</button>
      </div>
      <button type="button" className="mt-3 w-full py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/15 transition-colors"
        onClick={() => requirePin(() => setOpen(true), 'Confirm Factory Reset', 'Enter admin PIN to access reset')}>Factory Reset…</button>
      {open && <FactoryResetModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); onHide(); }} />}
    </div>
  );
}
