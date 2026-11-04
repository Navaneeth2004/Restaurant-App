import { useState } from 'react';
import { factoryReset } from 'api/office/backup.api';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { RESET_PHRASE } from 'config/constants';
import { useToastAction } from 'hooks/async/useToastAction';

interface Props { onClose: () => void; onDone: () => void }
const RED = 'btn flex-1 bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25';
const DELETED = ['All orders and order history', 'Photos and the logo', 'All menu items and categories', 'All tables (the 8 default tables come back)', 'Settings: tax %, GST details, brand colour, currency, admin lock'];
const KEPT = ['Staff accounts and PINs', 'The restaurant name', 'Linked devices'];

/** Three deliberate steps: understand → confirm a backup exists → type the phrase. */
export default function FactoryResetModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState('');
  const { busy, run } = useToastAction();
  const reset = async (): Promise<void> => { if (await run(() => factoryReset(), { success: 'Factory reset complete.', failure: 'Reset failed' })) onDone(); };

  return (
    <Modal title="Factory reset" className="max-w-sm border-red-500/40" z={90}>
      {step === 1 && (
        <>
          <p className="text-zinc-400 text-xs mb-3">This permanently resets this restaurant to a fresh start.</p>
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4 text-xs space-y-1">
            <p className="font-semibold text-red-400">What gets deleted:</p>
            {DELETED.map(d => <p key={d} className="text-red-400/80">• {d}</p>)}
            <p className="font-semibold text-emerald-400/80 pt-1">What is kept:</p>
            {KEPT.map(k => <p key={k} className="text-emerald-400/70">• {k}</p>)}
          </div>
          <div className="flex gap-2"><button type="button" className="btn flex-1" onClick={onClose}>Cancel</button><button type="button" className={RED} onClick={() => setStep(2)}>I understand, continue</button></div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="text-zinc-300 text-sm font-semibold mb-1">Did you take a backup?</p>
          <p className="text-zinc-500 text-xs mb-4">This cannot be undone. Use “Download Backup” first if you may need any of this later.</p>
          <div className="flex gap-2"><button type="button" className="btn flex-1" onClick={onClose}>No, cancel</button><button type="button" className={RED} onClick={() => setStep(3)}>Yes, I have a backup</button></div>
        </>
      )}
      {step === 3 && (
        <>
          <p className="text-zinc-400 text-xs mb-3">Type <span className="font-mono font-bold text-red-300 select-all">{RESET_PHRASE}</span> to confirm.</p>
          <input aria-label="Confirmation phrase" className="input w-full mb-3 font-mono text-red-300" placeholder={RESET_PHRASE} value={typed} onChange={e => setTyped(e.target.value)} autoFocus spellCheck={false} autoComplete="off" />
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn flex-1 bg-red-600 border-red-700 text-white hover:bg-red-700" disabled={busy || typed !== RESET_PHRASE} onClick={() => void reset()}>
              {busy ? <><Spinner />Resetting…</> : 'Reset Now'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
