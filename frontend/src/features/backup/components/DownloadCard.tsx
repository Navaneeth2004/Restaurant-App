import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useBackupDownload } from '../hooks/useBackup';

export default function DownloadCard() {
  const { requirePin } = useAdminLock();
  const { busy, download } = useBackupDownload();
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <p className="text-white text-sm font-semibold">Download Backup</p>
      <p className="text-zinc-500 text-xs mt-0.5 mb-3">Your database and all food photos as one zip file.</p>
      <button type="button" className="btn btn-brand btn-sm flex items-center gap-2" disabled={busy}
        onClick={() => requirePin(() => { void download(); }, 'Confirm Download', 'Enter admin PIN to download the backup')}>
        {busy ? <><Spinner />Preparing…</> : <><Icon name="download" className="w-3.5 h-3.5" />Download Backup</>}
      </button>
    </div>
  );
}
