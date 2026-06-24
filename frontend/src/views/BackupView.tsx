/**
 * views/BackupView.tsx
 *
 * Standalone Backup tab (admin-only) with a pill switcher between:
 * - Download / Restore (manual backup + factory reset)
 * - Local Auto-Backup
 * - Google Drive
 *
 * Content lifted from AdminBackup.tsx and its sub-sections.
 */

import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAdminLock } from '../context/AdminLockContext';
import { PinModal } from '../components/admin/PinModal';
import { useToast } from '../context/ToastContext';
import { authedFetch, authedJson, getToken } from '../utils/authedFetch';
import LocalBackupSection  from './admin/LocalBackupSection';
import GoogleDriveSection  from './admin/GoogleDriveSection';

const API = process.env.REACT_APP_API_URL || window.location.origin;

type Section = 'manual' | 'local' | 'drive';

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block flex-shrink-0" />
  );
}

// ── Factory Reset Modal ────────────────────────────────────────────────────

interface ResetModalProps { onClose: () => void; onDone: () => void; onError: (msg: string) => void; }

function FactoryResetModal({ onClose, onDone, onError }: ResetModalProps) {
  const PHRASE = 'RESET EVERYTHING';
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [typed,   setTyped]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const doReset = async () => {
    if (typed !== PHRASE) { setErr(`Type exactly: ${PHRASE}`); return; }
    setLoading(true); setErr('');
    try {
      await authedJson(`${API}/api/reset`, {
        method: 'POST',
        body: JSON.stringify({ confirm: PHRASE }),
      });
      onDone();
    } catch (e: any) {
      onError(e.message || 'Reset failed');
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-red-500/40 bg-surface-card p-5 w-full max-w-sm animate-slide-up shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {step === 1 && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-400 text-sm">Factory Reset</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                  This will permanently delete all order history, clear all table states, and remove all uploaded photos and logos.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-red-500/8 border border-red-500/20 p-3 mb-4 space-y-1.5 text-xs text-red-400/80">
              <p className="font-semibold text-red-400">What gets deleted:</p>
              <p>• All orders and order history</p>
              <p>• All food photos and the restaurant logo</p>
              <p>• Table statuses reset to empty</p>
              <p className="font-semibold text-emerald-400/80 pt-1">What is kept:</p>
              <p>• Menu items and categories</p>
              <p>• Staff and PINs</p>
              <p>• Restaurant settings and brand color</p>
            </div>
            <p className="text-zinc-600 text-xs mb-4">Take a backup first if you need to keep any history.</p>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose}>Cancel</button>
              <button className="btn flex-1 bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" onClick={() => setStep(2)}>
                I understand, continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-400 text-sm">Are you absolutely sure?</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 p-3 mb-4">
              <p className="text-zinc-300 text-xs font-semibold mb-0.5">Did you take a backup?</p>
              <p className="text-zinc-500 text-xs">Use the Download Backup button before proceeding.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose}>No, cancel</button>
              <button className="btn flex-1 bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" onClick={() => setStep(3)}>
                Yes, I have a backup
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-400 text-sm">Final confirmation</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                  Type <span className="font-mono font-bold text-red-300 select-all">{PHRASE}</span> to confirm.
                </p>
              </div>
            </div>
            <input
              className="input w-full mb-3 font-mono text-red-300 border-red-500/30 focus:border-red-500/60"
              placeholder={PHRASE}
              value={typed}
              onChange={e => { setTyped(e.target.value); setErr(''); }}
              autoFocus spellCheck={false} autoComplete="off"
            />
            {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose} disabled={loading}>Cancel</button>
              <button
                className="btn flex-1 bg-red-600 border-red-700 text-white hover:bg-red-700 disabled:opacity-40"
                onClick={doReset} disabled={loading || typed !== PHRASE}
              >
                {loading ? <><Spinner /> Resetting…</> : 'Reset Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Manual Backup section (Download + Restore + Danger Zone) ───────────────

function ManualSection() {
  const { config: lockConfig, requirePin } = useAdminLock();
  const toast = useToast();

  const [downloading,    setDownloading]    = useState(false);
  const [restoring,      setRestoring]      = useState(false);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [inlineRestoreFile, setInlineRestoreFile] = useState<File | null>(null);
  const [secretClicks,   setSecretClicks]   = useState(0);

  const restoreRef  = useRef<HTMLInputElement>(null);
  const secretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretClick = () => {
    setSecretClicks(n => {
      const next = n + 1;
      if (secretTimer.current) clearTimeout(secretTimer.current);
      if (next >= 5) { setShowResetPanel(true); return 0; }
      secretTimer.current = setTimeout(() => setSecretClicks(0), 2000);
      return next;
    });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await authedFetch(`${API}/api/backup/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pos_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Backup downloaded.', 'success');
    } catch (e: any) {
      toast(e.message || 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const guardedDownload = () => {
    if (!lockConfig.enabled) { handleDownload(); return; }
    requirePin(handleDownload, 'Confirm Download', 'Enter admin PIN to download backup');
  };

  const doRestore = async (file: File) => {
    setRestoring(true);
    try {
      const token = await getToken();
      const fd    = new FormData(); fd.append('backup', file);
      const h: Record<string, string> = {};
      if (token) h['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/backup/restore`, { method: 'POST', headers: h, body: fd });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error || 'Restore failed');
      toast(d.message || 'Restored. Please restart the POS.', 'success');
    } catch (e: any) {
      toast(e.message || 'Restore failed', 'error');
    } finally {
      setRestoring(false);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (restoreRef.current) restoreRef.current.value = '';
    setInlineRestoreFile(file);
  };

  const guardedShowResetModal = () => {
    if (!lockConfig.enabled) { setShowResetModal(true); return; }
    requirePin(() => setShowResetModal(true), 'Confirm Factory Reset', 'Enter admin PIN to access reset');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-white text-sm mb-1">Backup &amp; Restore</h3>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Protects your menu, orders, staff and settings. Back up regularly.
        </p>
      </div>

      {/* Download */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-white text-sm font-semibold">Download Backup</p>
            <p className="text-zinc-500 text-xs mt-0.5">Database and all food photos as a zip</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {[
            { label: 'Database', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75M3.75 13.5v3.75" /></svg> },
            { label: 'All photos', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg> },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised border border-surface-border text-xs text-zinc-400">
              {icon}{label}
            </div>
          ))}
        </div>
        <button onClick={guardedDownload} disabled={downloading} className="btn btn-brand btn-sm flex items-center gap-2">
          {downloading ? <><Spinner />Preparing…</> : (
            <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Download Backup</>
          )}
        </button>
      </div>

      {/* Restore */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-white text-sm font-semibold">Restore from Backup</p>
            <p className="text-zinc-500 text-xs mt-0.5">Upload a backup zip to recover your data</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21" />
            </svg>
          </div>
        </div>
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-3 mb-3">
          <p className="text-amber-400 text-xs">Replaces all current data. Restart the POS after restoring.</p>
        </div>
        <button onClick={() => restoreRef.current?.click()} disabled={restoring} className="btn btn-sm flex items-center gap-2">
          {restoring ? <><Spinner />Restoring…</> : (
            <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21" /></svg>Choose Backup File</>
          )}
        </button>
        <input ref={restoreRef} type="file" accept=".zip" className="hidden" onChange={handleRestoreFile} />
      </div>

      {/* Manual restore tip */}
      <div className="rounded-xl border border-surface-border bg-surface-raised px-4 py-3">
        <p className="text-zinc-500 text-xs leading-relaxed">
          <span className="text-zinc-300 font-semibold">To restore manually:</span>{' '}
          stop the POS, replace <span className="font-mono text-zinc-400">backend/data/restaurant.db</span> and{' '}
          <span className="font-mono text-zinc-400">uploads/</span> with files from the zip, then restart.
        </p>
      </div>

      {/* Secret version tap → danger zone */}
      <div className="text-center pt-2">
        <span className="text-zinc-800 text-[10px] cursor-default select-none" onClick={handleSecretClick}>v1.0.0</span>
      </div>

      {showResetPanel && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="text-red-400 text-xs font-semibold">Danger Zone</p>
              <p className="text-zinc-600 text-xs mt-0.5 leading-relaxed">
                Factory reset wipes all order history and images. Staff and menu are kept. Take a backup before proceeding.
              </p>
            </div>
            <button className="btn btn-sm bg-transparent border-transparent text-zinc-600 hover:text-zinc-400 flex-shrink-0 text-xs"
              onClick={() => setShowResetPanel(false)}>Hide</button>
          </div>
          <button
            className="mt-3 w-full py-2 rounded-lg border border-red-500/30 bg-red-500/8 text-red-400 text-xs font-semibold hover:bg-red-500/15 transition-colors"
            onClick={guardedShowResetModal}
          >
            Factory Reset…
          </button>
        </div>
      )}

      {/* Modals */}
      {showResetModal && (
        <FactoryResetModal
          onClose={() => setShowResetModal(false)}
          onError={(msg) => toast(msg, 'error')}
          onDone={() => {
            setShowResetModal(false);
            setShowResetPanel(false);
            toast('Factory reset complete. All orders and images have been wiped.', 'success');
          }}
        />
      )}

      {inlineRestoreFile && (
        <PinModal
          title="Confirm Restore"
          subtitle="Enter admin PIN to overwrite all current data with this backup"
          verifyFn={async (pin) => {
            try {
              const data = await authedJson(`${API}/api/staff/check-pin`, {
                method: 'POST',
                body: JSON.stringify({ pin }),
              });
              return data.valid === true;
            } catch { return false; }
          }}
          onSuccess={() => {
            const file = inlineRestoreFile;
            setInlineRestoreFile(null);
            doRestore(file);
          }}
          onCancel={() => setInlineRestoreFile(null)}
        />
      )}
    </div>
  );
}

// ── Main BackupView ────────────────────────────────────────────────────────

export default function BackupView() {
  const [section, setSection] = useState<Section>('manual');

  const tabs: { key: Section; label: string }[] = [
    { key: 'manual', label: 'Download / Restore' },
    { key: 'local',  label: 'Local Auto-Backup' },
    { key: 'drive',  label: 'Google Drive' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <h2 className="font-bold text-white text-sm flex-shrink-0 hidden sm:block">Backup</h2>
        {/* Pill switcher — scrolls horizontally if it ever doesn't fit, and the      buttons get whitespace-nowrap below so labels like "Local Auto-Backup"      never wrap mid-word inside the pill. */}
        <div className="sm:ml-auto flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5 overflow-x-auto no-scrollbar max-w-full">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                section === key ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {section === 'manual' && <ManualSection />}
        {section === 'local'  && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-white text-sm mb-1">Local Auto-Backup</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Automatically save backups to a folder on this computer. Keeps the last 7 backups. No internet required.
              </p>
            </div>
            <LocalBackupSection />
          </div>
        )}
        {section === 'drive'  && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-white text-sm mb-1">Google Drive Backup</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Back up automatically to your Google Drive. Requires a free Google Cloud OAuth key — setup takes about 5 minutes.
              </p>
            </div>
            <GoogleDriveSection />
          </div>
        )}
      </div>
    </div>
  );
}