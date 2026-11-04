import { useRef } from 'react';
import { checkPin } from 'api/access/staff.api';
import PinModal from 'components/pin/PinModal';
import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { useRestore } from '../hooks/useBackup';

export default function RestoreCard() {
  const input = useRef<HTMLInputElement>(null);
  const r = useRestore();
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <p className="text-white text-sm font-semibold">Restore from Backup</p>
      <p className="text-zinc-500 text-xs mt-0.5 mb-3">Upload a backup zip to recover your data.</p>
      <p className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3 text-amber-400 text-xs">
        Replaces ALL current data of this restaurant. Everyone — including you — is signed out afterwards and must sign in again.
      </p>
      <button type="button" className="btn btn-sm flex items-center gap-2" disabled={r.busy} onClick={() => input.current?.click()}>
        {r.busy ? <><Spinner />Restoring…</> : <><Icon name="upload" className="w-3.5 h-3.5" />Choose Backup File</>}
      </button>
      <input ref={input} type="file" accept=".zip,application/zip" aria-label="Backup file" className="hidden"
        onChange={e => { r.choose(e.target.files?.[0]); e.target.value = ''; }} />
      {r.file && (
        <PinModal title="Confirm Restore" subtitle={`Enter admin PIN to replace all current data with “${r.file.name}”`}
          verify={checkPin} onSuccess={() => void r.restore()} onCancel={r.cancel} />
      )}
    </div>
  );
}
