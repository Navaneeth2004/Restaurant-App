import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmModal from '../../components/ConfirmModal';

const API = process.env.REACT_APP_API_URL || window.location.origin;

let _token: string | null = null;
async function getToken(): Promise<string | null> {
  if (_token !== null) return _token;
  try { const r = await fetch(`${API}/api/auth/token`); const d = await r.json(); _token = d.token ?? null; return _token; }
  catch { return null; }
}
async function authedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const h: Record<string,string> = { ...(opts.headers as any || {}) };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers: h });
}
async function authedJson(url: string, opts: RequestInit = {}): Promise<any> {
  const h: Record<string,string> = { 'Content-Type':'application/json', ...(opts.headers as any || {}) };
  const token = await getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers: h });
  if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error((d as any).error || `Error ${r.status}`); }
  return r.json();
}

interface DriveStatus {
  configured:    boolean;
  connected:     boolean;
  last_backup:   string | null;
  last_filename: string | null;
  folder_name:   string | null;
  schedule:      string;
  redirect_uri:  string;
}

interface LocalStatus {
  folder:        string | null;
  schedule:      string;
  last_backup:   string | null;
  last_filename: string | null;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SCHEDULES = [
  { key: 'off',   label: 'Off' },
  { key: '1h',    label: 'Every hour' },
  { key: '2h',    label: 'Every 2h' },
  { key: '6h',    label: 'Every 6h' },
  { key: '12h',   label: 'Every 12h' },
  { key: 'daily', label: 'Daily' },
];

// ── Icon helpers ──────────────────────────────────────────────────────────
const IconDownload = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
);
const IconUpload = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21"/></svg>
);
const IconCloud = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.572 11.095H6.75z"/></svg>
);
const IconCheck = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
);
const IconWarn = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
);
const IconDatabase = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75M3.75 13.5v3.75"/></svg>
);
const IconPhoto = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg>
);
const IconClock = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
);
const IconCopy = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/></svg>
);

const GoogleDriveBadge = () => (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-raised border border-surface-border flex-shrink-0">
    <div className="grid grid-cols-2 gap-0.5" style={{ width: 14, height: 14 }}>
      <div style={{ background: '#4285f4', borderRadius: 1 }} />
      <div style={{ background: '#34a853', borderRadius: 1 }} />
      <div style={{ background: '#fbbc05', borderRadius: 1 }} />
      <div style={{ background: '#ea4335', borderRadius: 1 }} />
    </div>
    <span className="text-xs font-medium text-zinc-400">Drive</span>
  </div>
);

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block flex-shrink-0" />;
}

function Flash({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs leading-relaxed ${ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {ok ? <IconCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <IconWarn className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
      <span>{text}</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-surface-border bg-surface-card ${className}`}>{children}</div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-white px-2 py-1 rounded border border-surface-border hover:border-zinc-600 transition-colors flex-shrink-0">
      {copied ? <><IconCheck className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></> : <><IconCopy className="w-3 h-3" />Copy</>}
    </button>
  );
}

// ── Factory Reset Modal ───────────────────────────────────────────────────
// Three-step confirmation: checkbox → confirm modal → type phrase
interface ResetModalProps { onClose: () => void; onDone: () => void; }

function FactoryResetModal({ onClose, onDone }: ResetModalProps) {
  const PHRASE = 'RESET EVERYTHING';
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [typed,   setTyped]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const doReset = async () => {
    if (typed !== PHRASE) { setErr(`Type exactly: ${PHRASE}`); return; }
    setLoading(true); setErr('');
    try {
      await authedJson(`${API}/api/reset`, { method: 'POST', body: JSON.stringify({ confirm: PHRASE }) });
      onDone();
    } catch (e: any) {
      setErr(e.message || 'Reset failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-xl border border-red-500/40 bg-surface-card p-5 w-full max-w-sm animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Step 1: Warning */}
        {step === 1 && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
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

        {/* Step 2: Second confirmation modal embedded */}
        {step === 2 && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-red-400 text-sm">Are you absolutely sure?</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                  This action cannot be undone. There is no undo, no recovery, no second chance.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 p-3 mb-4">
              <p className="text-zinc-300 text-xs font-semibold mb-0.5">Did you take a backup?</p>
              <p className="text-zinc-500 text-xs">Use the Download Backup button above before proceeding.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose}>No, cancel</button>
              <button className="btn flex-1 bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" onClick={() => setStep(3)}>
                Yes, I have a backup
              </button>
            </div>
          </>
        )}

        {/* Step 3: Type the confirmation phrase */}
        {step === 3 && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-red-400 text-sm">Final confirmation</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                  Type <span className="font-mono font-bold text-red-300 select-all">{PHRASE}</span> to confirm the reset.
                </p>
              </div>
            </div>
            <input
              className="input w-full mb-3 font-mono text-red-300 border-red-500/30 focus:border-red-500/60"
              placeholder={PHRASE}
              value={typed}
              onChange={e => { setTyped(e.target.value); setErr(''); }}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose} disabled={loading}>Cancel</button>
              <button
                className="btn flex-1 bg-red-600 border-red-700 text-white hover:bg-red-700 disabled:opacity-40"
                onClick={doReset}
                disabled={loading || typed !== PHRASE}
              >
                {loading ? <><Spinner /> Resetting…</> : 'Reset Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main AdminBackup component ────────────────────────────────────────────
export default function AdminBackup() {
  const [status,        setStatus]        = useState<DriveStatus | null>(null);
  const [localStatus,   setLocalStatus]   = useState<LocalStatus | null>(null);
  const [downloading,   setDownloading]   = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [connecting,    setConnecting]    = useState(false);
  const [restoring,     setRestoring]     = useState(false);
  const [savingCreds,   setSavingCreds]   = useState(false);
  const [savingSched,   setSavingSched]   = useState(false);
  const [saveLocalSched, setSaveLocalSched] = useState(false);
  const [localBacking,  setLocalBacking]  = useState(false);
  const [showCreds,     setShowCreds]     = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);
  const [clientId,      setClientId]      = useState('');
  const [clientSecret,  setClientSecret]  = useState('');
  const [selectedSched, setSelectedSched] = useState('off');
  const [selectedLocalSched, setSelectedLocalSched] = useState('off');
  const [localFolder,   setLocalFolder]   = useState('');
  const [msg,           setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  // Hidden reset: click version text 5 times quickly
  const [secretClicks,   setSecretClicks]  = useState(0);
  const secretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 7000); };

  const loadStatus = useCallback(async () => {
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/status`);
      setStatus(d);
      setSelectedSched(d.schedule || 'off');
    } catch {}
  }, []);

  const loadLocalStatus = useCallback(async () => {
    try {
      const d = await authedJson(`${API}/api/backup/local/status`);
      setLocalStatus(d);
      setSelectedLocalSched(d.schedule || 'off');
      if (d.folder) setLocalFolder(d.folder);
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); loadLocalStatus(); }, []);

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data === 'gdrive_connected') { setConnecting(false); flash(true, 'Google Drive connected!'); loadStatus(); }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  // Secret click handler — 5 clicks within 2 seconds reveals reset
  const handleSecretClick = () => {
    setSecretClicks(n => {
      const next = n + 1;
      if (secretTimer.current) clearTimeout(secretTimer.current);
      if (next >= 5) {
        setShowResetPanel(true);
        return 0;
      }
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
      a.href = url; a.download = `pos_backup_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      flash(true, 'Backup downloaded.');
    } catch (e: any) { flash(false, e.message || 'Download failed'); }
    finally { setDownloading(false); }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('This will overwrite your current database and images. Continue?')) {
      if (restoreRef.current) restoreRef.current.value = ''; return;
    }
    setRestoring(true);
    try {
      const token = await getToken();
      const fd = new FormData(); fd.append('backup', file);
      const h: Record<string,string> = {};
      if (token) h['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/backup/restore`, { method:'POST', headers:h, body:fd });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error || 'Restore failed');
      flash(true, d.message || 'Restored. Please restart the POS.');
    } catch (e: any) { flash(false, e.message || 'Restore failed'); }
    finally { setRestoring(false); if (restoreRef.current) restoreRef.current.value = ''; }
  };

  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) { flash(false, 'Both fields are required.'); return; }
    setSavingCreds(true);
    try {
      await authedJson(`${API}/api/backup/gdrive/credentials`, {
        method: 'PUT',
        body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
      });
      flash(true, 'Credentials saved. Now click "Connect Google Drive".');
      setShowCreds(false); setClientId(''); setClientSecret('');
      loadStatus();
    } catch (e: any) { flash(false, e.message || 'Failed'); }
    finally { setSavingCreds(false); }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/auth`);
      const popup = window.open(d.url, 'gdrive_auth', 'width=500,height=650,scrollbars=yes');
      if (!popup) { flash(false, 'Popup blocked — allow popups for this page.'); setConnecting(false); }
    } catch (e: any) { flash(false, e.message || 'Failed'); setConnecting(false); }
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/upload`, { method:'POST' });
      flash(true, `Backed up to Drive — ${d.folder}/${d.filename}`);
      loadStatus();
    } catch (e: any) {
      flash(false, e.message || 'Upload failed');
      if (e.message?.includes('expired')) loadStatus();
    } finally { setUploading(false); }
  };

  const handleSaveSchedule = async () => {
    setSavingSched(true);
    try {
      await authedJson(`${API}/api/backup/gdrive/schedule`, { method:'PUT', body:JSON.stringify({ schedule:selectedSched }) });
      flash(true, selectedSched === 'off' ? 'Auto-backup disabled.' : `Auto-backup: ${SCHEDULES.find(s=>s.key===selectedSched)?.label}`);
      loadStatus();
    } catch (e: any) { flash(false, e.message || 'Failed'); }
    finally { setSavingSched(false); }
  };

  const handleSaveLocalSchedule = async () => {
    setSaveLocalSched(true);
    try {
      await authedJson(`${API}/api/backup/local/config`, {
        method: 'PUT',
        body: JSON.stringify({ folder: localFolder.trim() || null, schedule: selectedLocalSched }),
      });
      flash(true, selectedLocalSched === 'off' ? 'Local auto-backup disabled.' : `Local auto-backup: ${SCHEDULES.find(s=>s.key===selectedLocalSched)?.label}`);
      loadLocalStatus();
    } catch (e: any) { flash(false, e.message || 'Failed'); }
    finally { setSaveLocalSched(false); }
  };

  const handleLocalBackupNow = async () => {
    setLocalBacking(true);
    try {
      const d = await authedJson(`${API}/api/backup/local/now`, { method:'POST', body:JSON.stringify({ folder: localFolder.trim() || null }) });
      flash(true, `Saved to ${d.path}`);
      loadLocalStatus();
    } catch (e: any) { flash(false, e.message || 'Local backup failed'); }
    finally { setLocalBacking(false); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Backups in Drive will not be deleted.')) return;
    try { await authedJson(`${API}/api/backup/gdrive/disconnect`, { method:'DELETE' }); flash(true, 'Disconnected.'); loadStatus(); }
    catch (e: any) { flash(false, e.message || 'Failed'); }
  };

  const schedLabel   = SCHEDULES.find(s => s.key === (status?.schedule || 'off'))?.label || 'Off';
  const redirectUri  = status?.redirect_uri || `${window.location.origin}/api/backup/gdrive/callback`;

  return (
    <div className="space-y-4 max-w-xl">
      {/* Header */}
      <div>
        <h3 className="font-bold text-white text-base mb-1">Backup &amp; Restore</h3>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Protects your menu, orders, staff and settings. Back up regularly.
        </p>
      </div>

      {msg && <Flash ok={msg.ok} text={msg.text} />}

      {/* ── Download + Restore ── */}
      <Card className="divide-y divide-surface-border overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-white text-sm font-semibold">Download Backup</p>
              <p className="text-zinc-500 text-xs mt-0.5">Database and all food photos as a zip</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center flex-shrink-0">
              <IconDownload className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[{ icon:<IconDatabase />, label:'Database' }, { icon:<IconPhoto />, label:'All photos' }].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-raised border border-surface-border text-xs text-zinc-400">{icon}{label}</div>
            ))}
          </div>
          <button onClick={handleDownload} disabled={downloading} className="btn btn-brand btn-sm flex items-center gap-2">
            {downloading ? <><Spinner />Preparing…</> : <><IconDownload className="w-3.5 h-3.5" />Download Backup</>}
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-white text-sm font-semibold">Restore from Backup</p>
              <p className="text-zinc-500 text-xs mt-0.5">Upload a backup zip to recover your data</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center flex-shrink-0">
              <IconUpload className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-3 mb-3">
            <p className="text-amber-400 text-xs">Replaces all current data. Restart the POS after restoring.</p>
          </div>
          <button onClick={() => restoreRef.current?.click()} disabled={restoring} className="btn btn-sm flex items-center gap-2">
            {restoring ? <><Spinner />Restoring…</> : <><IconUpload className="w-3.5 h-3.5" />Choose Backup File</>}
          </button>
          <input ref={restoreRef} type="file" accept=".zip" className="hidden" onChange={handleRestoreFile} />
        </div>
      </Card>

      {/* ── Local Auto-Backup ── */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-surface-border">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-white text-sm font-semibold">Local Auto-Backup</p>
            <div className="flex items-center gap-2">
              {localStatus?.schedule && localStatus.schedule !== 'off' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/25 text-brand-400">
                  {SCHEDULES.find(s => s.key === localStatus.schedule)?.label}
                </span>
              )}
            </div>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Automatically save backups to a folder on this computer. Keeps the last 7 backups.
          </p>
          {localStatus?.last_backup && (
            <p className="text-zinc-600 text-xs mt-1">
              Last saved: <span className="text-zinc-400">{timeAgo(localStatus.last_backup)}</span>
              {localStatus.last_filename && <span className="text-zinc-600"> — {localStatus.last_filename}</span>}
            </p>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="label">Backup Folder Path</label>
            <input
              className="input text-xs font-mono"
              placeholder="e.g. C:\Backups\POS  or  /home/user/pos-backups"
              value={localFolder}
              onChange={e => setLocalFolder(e.target.value)}
            />
            <p className="text-zinc-600 text-[10px] mt-1">Leave blank to use backend/data/backups/ (inside the app folder)</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <IconClock />
              <p className="text-white text-xs font-semibold">Auto-backup Schedule</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {SCHEDULES.map(s => (
                <button key={s.key} onClick={() => setSelectedLocalSched(s.key)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    selectedLocalSched === s.key
                      ? 'bg-brand-500 border-brand-600 text-white'
                      : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn btn-brand btn-sm flex items-center gap-2"
                onClick={handleSaveLocalSchedule}
                disabled={saveLocalSched}
              >
                {saveLocalSched ? <><Spinner />Saving…</> : 'Save Schedule'}
              </button>
              <button
                className="btn btn-sm flex items-center gap-2"
                onClick={handleLocalBackupNow}
                disabled={localBacking}
              >
                {localBacking ? <><Spinner />Backing up…</> : <><IconDownload className="w-3.5 h-3.5" />Back Up Now</>}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Google Drive ── */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-surface-border">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-white text-sm font-semibold">Google Drive Backup</p>
            <GoogleDriveBadge />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {status?.connected
              ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>Connected</span>
              : status !== null
                ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600"/>Not connected</span>
                : null
            }
            {status?.last_backup && (
              <span className="text-zinc-600 text-xs">Last: <span className="text-zinc-400">{timeAgo(status.last_backup)}</span></span>
            )}
            {status?.connected && status.schedule !== 'off' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/25 text-brand-400">Auto: {schedLabel}</span>
            )}
          </div>
        </div>

        {/* Step-by-step setup guide */}
        {status !== null && !status.configured && !showCreds && (
          <div className="p-4 border-b border-surface-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-300 text-xs font-semibold">Setup Guide — Google Drive Backup</p>
              <button
                onClick={() => setShowDriveGuide(g => !g)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                {showDriveGuide ? 'Hide' : 'Show steps'}
                <svg className={`w-3 h-3 transition-transform ${showDriveGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed mb-3">
              Needs a free Google Cloud OAuth key — takes about 5 minutes, done once.
            </p>

            {showDriveGuide && (
              <div className="space-y-3 mb-4">
                {[
                  {
                    n: 1,
                    title: 'Open Google Cloud Console',
                    body: <>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-brand-400 underline underline-offset-2">console.cloud.google.com</a>. Sign in with your Google account (any Gmail account works — no paid plan needed).</>,
                  },
                  {
                    n: 2,
                    title: 'Create a new project',
                    body: <>Click the project dropdown at the top → <span className="text-zinc-300 font-medium">New Project</span>. Name it anything, e.g. "Restaurant POS". Click <span className="text-zinc-300 font-medium">Create</span>.</>,
                  },
                  {
                    n: 3,
                    title: 'Enable the Google Drive API',
                    body: <>In the left menu go to <span className="text-zinc-300 font-medium">APIs &amp; Services → Library</span>. Search for <span className="font-mono text-zinc-300">Google Drive API</span> and click <span className="text-zinc-300 font-medium">Enable</span>.</>,
                  },
                  {
                    n: 4,
                    title: 'Configure the OAuth consent screen',
                    body: <>Go to <span className="text-zinc-300 font-medium">APIs &amp; Services → OAuth consent screen</span>. Choose <span className="text-zinc-300 font-medium">External</span>, fill in an app name (e.g. "Restaurant POS"), your email, and click Save. On the Scopes page just click Save. On the Test users page add your own Gmail address, then click Save.</>,
                  },
                  {
                    n: 5,
                    title: 'Create OAuth credentials',
                    body: <>Go to <span className="text-zinc-300 font-medium">APIs &amp; Services → Credentials</span> → <span className="text-zinc-300 font-medium">+ Create Credentials → OAuth 2.0 Client ID</span>. Set Application type to <span className="text-zinc-300 font-medium">Web application</span>. Under <span className="text-zinc-300 font-medium">Authorised redirect URIs</span>, paste the URI below exactly.</>,
                  },
                  {
                    n: 6,
                    title: 'Copy your Client ID and Client Secret',
                    body: <>After saving you'll see a popup with <span className="text-zinc-300 font-medium">Client ID</span> and <span className="text-zinc-300 font-medium">Client Secret</span>. Copy both and paste them into the form below.</>,
                  },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step.n}
                    </div>
                    <div>
                      <p className="text-zinc-200 text-xs font-semibold mb-0.5">{step.title}</p>
                      <p className="text-zinc-500 text-xs leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}

                <div className="mt-3">
                  <p className="text-zinc-500 text-xs mb-1.5">Your redirect URI (copy this into Google Console — Step 5):</p>
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                    <code className="text-zinc-200 text-[11px] break-all flex-1 select-all">{redirectUri}</code>
                    <CopyButton text={redirectUri} />
                  </div>
                  <p className="text-amber-400 text-[10px] leading-relaxed mt-1.5">
                    This URI changes if you switch between localhost and the network IP. Always copy from here.
                  </p>
                </div>
              </div>
            )}

            {!showDriveGuide && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 mb-3">
                <code className="text-zinc-200 text-[11px] break-all flex-1 select-all">{redirectUri}</code>
                <CopyButton text={redirectUri} />
              </div>
            )}

            <button className="btn btn-brand btn-sm" onClick={() => { setShowCreds(true); setShowDriveGuide(false); }}>
              Enter credentials
            </button>
          </div>
        )}

        {/* Credential form */}
        {showCreds && (
          <div className="p-4 border-b border-surface-border space-y-3">
            <p className="text-white text-xs font-semibold">{status?.configured ? 'Update credentials' : 'Enter OAuth credentials'}</p>
            <div>
              <label className="label">Client ID</label>
              <input className="input font-mono text-xs" placeholder="1234567890-abc...apps.googleusercontent.com" value={clientId} onChange={e => setClientId(e.target.value)} />
            </div>
            <div>
              <label className="label">Client Secret</label>
              <input className="input font-mono text-xs" type="password" placeholder="GOCSPX-..." value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-brand btn-sm" onClick={handleSaveCreds} disabled={savingCreds || !clientId || !clientSecret}>
                {savingCreds ? <><Spinner />Saving…</> : 'Save Credentials'}
              </button>
              <button className="btn btn-sm" onClick={() => setShowCreds(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Configured but not connected */}
        {status?.configured && !status.connected && !showCreds && (
          <div className="p-4 border-b border-surface-border space-y-3">
            <div>
              <p className="text-zinc-500 text-xs mb-1">Redirect URI must match exactly in Google Console:</p>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                <code className="text-zinc-200 text-[11px] break-all flex-1 select-all">{redirectUri}</code>
                <CopyButton text={redirectUri} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-brand btn-sm flex items-center gap-2" onClick={handleConnect} disabled={connecting}>
                {connecting ? <><Spinner />Waiting for Google…</> : <><IconCloud className="w-3.5 h-3.5" />Connect Google Drive</>}
              </button>
              <button className="btn btn-sm" onClick={() => setShowCreds(true)}>Update credentials</button>
            </div>
          </div>
        )}

        {/* Connected — manual backup */}
        {status?.connected && (
          <div className="p-4 border-b border-surface-border">
            <p className="text-zinc-500 text-xs mb-3">
              Saves to <span className="text-zinc-300">Restaurant POS Backups / restaurant_pos_backup.zip</span> — overwrites each time.
            </p>
            <button className="btn btn-brand btn-sm flex items-center gap-2" onClick={handleUpload} disabled={uploading}>
              {uploading ? <><Spinner />Uploading…</> : <><IconCloud className="w-3.5 h-3.5" />Back Up to Drive Now</>}
            </button>
          </div>
        )}

        {/* Schedule */}
        {status?.configured && (
          <div className="p-4 border-b border-surface-border">
            <div className="flex items-center gap-2 mb-2">
              <IconClock />
              <p className="text-white text-xs font-semibold">Drive Auto-backup Schedule</p>
            </div>
            {!status.connected && <p className="text-zinc-600 text-xs mb-2">Connect Google Drive first to use auto-backup.</p>}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {SCHEDULES.map(s => (
                <button key={s.key} onClick={() => setSelectedSched(s.key)}
                  disabled={!status.connected}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    selectedSched === s.key
                      ? 'bg-brand-500 border-brand-600 text-white'
                      : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <button className="btn btn-sm flex items-center gap-2" onClick={handleSaveSchedule}
              disabled={savingSched || selectedSched === status.schedule || !status.connected}>
              {savingSched ? <><Spinner />Saving…</> : 'Save Schedule'}
            </button>
          </div>
        )}

        {/* Bottom actions */}
        {status?.connected && (
          <div className="p-4 flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => setShowCreds(true)}>Update credentials</button>
            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>Disconnect Drive</button>
          </div>
        )}
      </Card>

      {/* Manual restore note */}
      <div className="rounded-xl border border-surface-border bg-surface-raised px-4 py-3">
        <p className="text-zinc-500 text-xs leading-relaxed">
          <span className="text-zinc-300 font-semibold">To restore manually:</span>{' '}
          stop the POS, replace <span className="font-mono text-zinc-400">backend/data/restaurant.db</span> and <span className="font-mono text-zinc-400">uploads/</span> with files from the zip, then restart.
        </p>
      </div>

      {/* ── Hidden factory reset trigger ── */}
      {/* Clicking the version string 5× quickly reveals it */}
      <div className="text-center pt-2">
        <span
          className="text-zinc-800 text-[10px] cursor-default select-none"
          onClick={handleSecretClick}
          title=""
        >
          v1.0.0
        </span>
      </div>

      {showResetPanel && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <div className="flex-1">
              <p className="text-red-400 text-xs font-semibold">Danger Zone</p>
              <p className="text-zinc-600 text-xs mt-0.5 leading-relaxed">
                Factory reset wipes all order history and images. Staff and menu are kept.
                Take a backup before proceeding.
              </p>
            </div>
            <button
              className="btn btn-sm bg-transparent border-transparent text-zinc-600 hover:text-zinc-400 flex-shrink-0 text-xs"
              onClick={() => setShowResetPanel(false)}
            >
              Hide
            </button>
          </div>
          <button
            className="mt-3 w-full py-2 rounded-lg border border-red-500/30 bg-red-500/8 text-red-400 text-xs font-semibold hover:bg-red-500/15 transition-colors"
            onClick={() => setShowResetModal(true)}
          >
            Factory Reset…
          </button>
        </div>
      )}

      {/* Factory reset modal (3-step) */}
      {showResetModal && (
        <FactoryResetModal
          onClose={() => setShowResetModal(false)}
          onDone={() => {
            setShowResetModal(false);
            setShowResetPanel(false);
            flash(true, 'Factory reset complete. All orders and images have been wiped.');
          }}
        />
      )}
    </div>
  );
}