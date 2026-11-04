import { useState } from 'react';
import { downloadBackup, restoreBackup } from 'api/office/backup.api';
import { MAX_BACKUP_MB } from 'config/constants';
import { useToastAction } from 'hooks/async/useToastAction';
import { downloadBlob } from 'lib/browser/download';
import { todayStr } from 'lib/format/local-time';
import { useAuth } from 'state/auth/useAuth';
import { useToast } from 'state/toast/useToast';

/** Download of the backup zip (the caller asks for the admin PIN first). */
export function useBackupDownload() {
  const { busy, run } = useToastAction();
  const download = (): Promise<boolean> => run(async () => downloadBlob(await downloadBackup(), `pos_backup_${todayStr()}.zip`), { success: 'Backup downloaded.', failure: 'Download failed' });
  return { busy, download };
}

/**
 * Restore: pick a zip → confirm with the admin PIN → upload. A restore replaces ALL data and ends every staff session
 * (including this one), so on success we show the server's message and go back to the PIN screen ourselves.
 */
export function useRestore() {
  const [file, setFile] = useState<File | null>(null);
  const { busy, run } = useToastAction();
  const { logout } = useAuth();
  const toast = useToast();

  const choose = (f: File | undefined): void => {
    if (!f) return;
    if (f.size > MAX_BACKUP_MB * 1024 * 1024) { toast(`That file is larger than ${MAX_BACKUP_MB} MB, the most the server accepts.`, 'error'); return; }
    setFile(f);
  };
  const restore = async (): Promise<void> => {
    if (!file) return;
    const chosen = file;
    setFile(null);
    let message = 'Restored. Everyone must log in again.';
    const ok = await run(async () => { const r = await restoreBackup(chosen); if (r.message) message = r.message; }, { failure: 'Restore failed' });
    if (ok) { toast(message, 'success'); await logout(); }
  };
  return { file, choose, cancel: () => setFile(null), restore, busy };
}
