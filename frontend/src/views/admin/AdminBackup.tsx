import React, { useState, useEffect, useCallback, useRef } from 'react';

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
  redirect_uri:  string; // exact URI the server will use
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

export default function AdminBackup() {
  const [status,        setStatus]        = useState<DriveStatus | null>(null);
  const [downloading,   setDownloading]   = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [connecting,    setConnecting]    = useState(false);
  const [restoring,     setRestoring]     = useState(false);
  const [savingCreds,   setSavingCreds]   = useState(false);
  const [savingSched,   setSavingSched]   = useState(false);
  const [showCreds,     setShowCreds]     = useState(false);
  const [clientId,      setClientId]      = useState('');
  const [clientSecret,  setClientSecret]  = useState('');
  const [selectedSched, setSelectedSched] = useState('off');
  const [msg,           setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 7000); };

  const loadStatus = useCallback(async () => {
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/status`);
      setStatus(d);
      setSelectedSched(d.schedule || 'off');
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data === 'gdrive_connected') { setConnecting(false); flash(true, 'Google Drive connected!'); loadStatus(); }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

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
      // FIX: only send client_id and client_secret — backend derives redirect_uri from request
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

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Backups in Drive will not be deleted.')) return;
    try { await authedJson(`${API}/api/backup/gdrive/disconnect`, { method:'DELETE' }); flash(true, 'Disconnected.'); loadStatus(); }
    catch (e: any) { flash(false, e.message || 'Failed'); }
  };

  const schedLabel   = SCHEDULES.find(s => s.key === (status?.schedule || 'off'))?.label || 'Off';
  const redirectUri  = status?.redirect_uri || `${window.location.origin}/api/backup/gdrive/callback`;

  return (
    <div className="space-y-4 max-w-xl">
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

        {/* Setup notice */}
        {status !== null && !status.configured && !showCreds && (
          <div className="p-4 border-b border-surface-border">
            <p className="text-zinc-300 text-xs font-semibold mb-1">One-time setup required</p>
            <p className="text-zinc-500 text-xs leading-relaxed mb-3">
              Needs a free Google Cloud OAuth key — takes about 5 minutes, done once.
            </p>
            <ol className="text-zinc-500 text-xs space-y-1 mb-3 pl-4 list-decimal">
              <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-brand-400 underline underline-offset-2">Google Cloud Console → Credentials</a></li>
              <li>Create credentials → OAuth 2.0 Client ID → Web application</li>
              <li>Add this as an Authorised redirect URI:</li>
            </ol>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 mb-3">
              <code className="text-zinc-200 text-[11px] break-all flex-1 select-all">{redirectUri}</code>
              <CopyButton text={redirectUri} />
            </div>
            <p className="text-amber-400 text-[10px] leading-relaxed mb-3">
              This URI changes if you switch between localhost and the network IP. Always copy from here — do not type it manually.
            </p>
            <button className="btn btn-brand btn-sm" onClick={() => setShowCreds(true)}>Enter credentials</button>
          </div>
        )}

        {/* Credential form */}
        {(showCreds || (status !== null && !status.configured && showCreds)) && (
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
            {/* Always show the exact redirect URI so they can verify it matches */}
            <div>
              <p className="text-zinc-500 text-xs mb-1">Redirect URI in Google Console must match exactly:</p>
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

        {/* Schedule — shown whenever configured */}
        {status?.configured && (
          <div className="p-4 border-b border-surface-border">
            <div className="flex items-center gap-2 mb-2">
              <IconClock />
              <p className="text-white text-xs font-semibold">Auto-backup Schedule</p>
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
    </div>
  );
}