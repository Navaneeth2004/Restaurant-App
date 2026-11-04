import { useRef } from 'react';
import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useMenuTransfer } from '../hooks/useMenuTransfer';

export default function MenuExportImport() {
  const { exporting, importing, outcome, doExport, doImport } = useMenuTransfer();
  const { config, requirePin } = useAdminLock();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined): void => {
    if (fileRef.current) fileRef.current.value = '';
    if (file) requirePin(() => { void doImport(file); }, 'Import Menu', 'Enter admin PIN to import the menu');
  };
  const lockIcon = config.enabled && <Icon name="lock" className="w-3 h-3 text-zinc-600 ml-auto" />;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="font-bold text-white text-sm mb-1">Export / Import Menu</h3>
      <p className="text-zinc-500 text-xs mb-4">Move your full menu — including item photos — to another device or create a backup</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
          <div className="flex items-center gap-2 mb-2"><Icon name="download" className="w-4 h-4 text-zinc-400" /><span className="text-white text-xs font-semibold">Export Menu</span>{lockIcon}</div>
          <p className="text-zinc-600 text-xs mb-3">Downloads a <span className="text-zinc-400 font-mono">.zip</span> with all categories, items and photos.</p>
          <button type="button" className="btn btn-brand btn-sm w-full" disabled={exporting} onClick={() => requirePin(() => { void doExport(); }, 'Export Menu', 'Enter admin PIN to download the menu')}>
            {exporting ? <><Spinner />Exporting…</> : 'Download menu.zip'}
          </button>
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
          <div className="flex items-center gap-2 mb-2"><Icon name="upload" className="w-4 h-4 text-zinc-400" /><span className="text-white text-xs font-semibold">Import Menu</span>{lockIcon}</div>
          <p className="text-zinc-600 text-xs mb-3">Upload a <span className="text-zinc-400 font-mono">.zip</span> or <span className="text-zinc-400 font-mono">.json</span>. Existing items are kept; duplicates skipped.</p>
          <button type="button" className="btn btn-sm w-full" disabled={importing} onClick={() => fileRef.current?.click()}>{importing ? <><Spinner />Importing…</> : 'Choose .zip or .json'}</button>
          <input ref={fileRef} type="file" aria-label="Menu file" accept=".zip,.json,application/zip,application/x-zip-compressed,application/json" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        </div>
      </div>
      {outcome && (
        <div role={outcome.kind === 'error' ? 'alert' : 'status'} className={`mt-3 p-3 rounded-lg border text-xs ${outcome.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{outcome.text}</div>
      )}
    </div>
  );
}
