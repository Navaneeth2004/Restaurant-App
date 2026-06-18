/**
 * views/admin/MenuExportImport.tsx
 *
 * Export / Import panel for the menu — download a .zip with all items
 * and photos, or upload one to restore / migrate a menu.
 * Extracted from AdminMenu.tsx.
 */

import React from 'react';
import { useToast }      from '../../context/ToastContext';
import { useAdminLock }  from '../../context/AdminLockContext';

const BASE = process.env.REACT_APP_API_URL || window.location.origin;

// ── Auth token helpers ────────────────────────────────────────────────────
let _tok: string | null = null;
async function tok(): Promise<string | null> {
  if (_tok !== null) return _tok;
  try {
    const r = await fetch(`${BASE}/api/auth/token`);
    const d = await r.json();
    _tok = d.token ?? null;
    return _tok;
  } catch { return null; }
}
async function authedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const t = await tok();
  const h: Record<string, string> = { ...(opts.headers as any || {}) };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return fetch(url, { ...opts, headers: h });
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MenuExportImport() {
  const [importing,    setImporting]    = React.useState(false);
  const [importResult, setImportResult] = React.useState<string | null>(null);
  const [importError,  setImportError]  = React.useState<string | null>(null);
  const [exporting,    setExporting]    = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const toast   = useToast();
  const { requirePin, config: lockConfig } = useAdminLock();

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await authedFetch(`${BASE}/api/export/menu`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || `Export failed (${res.status})`);
      }
      const blob    = await res.blob();
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download    = `menu_export_${dateStr}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Menu exported', 'success');
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (!lockConfig.enabled) { doExport(); return; }
    requirePin(doExport, 'Export Menu', 'Enter admin PIN to download menu');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const doImport = async () => {
      setImporting(true);
      setImportResult(null);
      setImportError(null);
      try {
        let res: Response;
        if (
          file.name.endsWith('.zip') ||
          file.type === 'application/zip' ||
          file.type === 'application/x-zip-compressed'
        ) {
          const fd = new FormData();
          fd.append('menuzip', file);
          res = await authedFetch(`${BASE}/api/export/menu/import`, { method: 'POST', body: fd });
        } else if (file.name.endsWith('.json') || file.type === 'application/json') {
          const text = await file.text();
          const data = JSON.parse(text);
          res = await authedFetch(`${BASE}/api/export/menu/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
        } else {
          throw new Error('Please choose a .zip or .json file');
        }
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Import failed');
        const imgNote = result.images_imported > 0 ? `, ${result.images_imported} images` : '';
        setImportResult(
          `Done — ${result.categories_added} categories added, ${result.items_added} items added${imgNote}, ${result.items_skipped} skipped`
        );
        toast('Menu imported successfully', 'success');
      } catch (e: any) {
        const msg = e.message || 'Import failed — check file format';
        setImportError(msg);
        toast(msg, 'error');
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };

    if (!lockConfig.enabled) { doImport(); return; }
    requirePin(doImport, 'Import Menu', 'Enter admin PIN to import menu');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="font-bold text-white text-sm mb-1">Export / Import Menu</h3>
      <p className="text-zinc-500 text-xs mb-4">
        Move your full menu — including item photos — to another device or create a backup
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export */}
        <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="text-white text-xs font-semibold">Export Menu</span>
            {lockConfig.enabled && (
              <svg className="w-3 h-3 text-zinc-600 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
          <p className="text-zinc-600 text-xs mb-3">
            Downloads a <span className="text-zinc-400 font-mono">.zip</span> with all categories, items and photos.
          </p>
          <button className="btn btn-brand btn-sm w-full" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Exporting…
                </span>
              : 'Download menu.zip'
            }
          </button>
        </div>

        {/* Import */}
        <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21" />
            </svg>
            <span className="text-white text-xs font-semibold">Import Menu</span>
            {lockConfig.enabled && (
              <svg className="w-3 h-3 text-zinc-600 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
          <p className="text-zinc-600 text-xs mb-3">
            Upload a <span className="text-zinc-400 font-mono">.zip</span> or{' '}
            <span className="text-zinc-400 font-mono">.json</span>. Existing items are kept; duplicates skipped.
          </p>
          <button
            className="btn btn-sm w-full border-surface-border"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />
                  Importing…
                </span>
              : 'Choose .zip or .json'
            }
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json,application/zip,application/x-zip-compressed,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {importResult && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {importResult}
        </div>
      )}
      {importError && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {importError}
        </div>
      )}
    </div>
  );
}