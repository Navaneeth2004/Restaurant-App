/**
 * frontend/src/views/admin/AdminBackup.tsx
 *
 * Two backup options:
 *   1. Direct download — one click, downloads a zip of the db + images
 *   2. Google Drive — connect once via OAuth, then backup with one click
 */

import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || window.location.origin;

// ── Auth token helper (same pattern as AdminStaff) ────────────────────────
let _token: string | null = null;
async function getToken(): Promise<string | null> {
  if (_token !== null) return _token;
  try {
    const r = await fetch(`${API}/api/auth/token`);
    const d = await r.json();
    _token = d.token ?? null;
    return _token;
  } catch { return null; }
}
async function authedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = { ...(opts.headers as any || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}
async function authedJson(url: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any || {}),
  };
  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error((d as any).error || `Request failed (${r.status})`);
  }
  return r.json();
}

interface DriveStatus {
  configured:    boolean;
  connected:     boolean;
  last_backup:   string | null;
  last_filename: string | null;
  folder_name:   string | null;
}

// ── Relative time helper ──────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      {children}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────
function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
      ok
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
        : 'text-zinc-500 bg-zinc-800 border-zinc-700'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      {label}
    </span>
  );
}

export default function AdminBackup() {
  const [driveStatus,   setDriveStatus]   = useState<DriveStatus | null>(null);
  const [downloading,   setDownloading]   = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [connecting,    setConnecting]    = useState(false);
  const [showCreds,     setShowCreds]     = useState(false);
  const [clientId,      setClientId]      = useState('');
  const [clientSecret,  setClientSecret]  = useState('');
  const [savingCreds,   setSavingCreds]   = useState(false);
  const [msg,           setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const loadStatus = useCallback(async () => {
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/status`);
      setDriveStatus(d);
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); }, []);

  // ── Listen for the OAuth popup message ───────────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'gdrive_connected') {
        setConnecting(false);
        flash(true, 'Google Drive connected successfully!');
        loadStatus();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Direct download ───────────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/backup/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `pos_backup_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash(true, 'Backup downloaded successfully.');
    } catch (e: any) {
      flash(false, e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  // ── Save OAuth credentials ────────────────────────────────────────────────
  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      flash(false, 'Both Client ID and Client Secret are required.');
      return;
    }
    setSavingCreds(true);
    try {
      const redirectUri = `${API}/api/backup/gdrive/callback`;
      await authedJson(`${API}/api/backup/gdrive/credentials`, {
        method: 'PUT',
        body: JSON.stringify({
          client_id:     clientId.trim(),
          client_secret: clientSecret.trim(),
          redirect_uri:  redirectUri,
        }),
      });
      flash(true, 'Credentials saved. Now click "Connect Google Drive".');
      setShowCreds(false);
      loadStatus();
    } catch (e: any) {
      flash(false, e.message || 'Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  // ── Start OAuth flow ──────────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await authedJson(`${API}/api/backup/gdrive/auth`);
      const popup = window.open(data.url, 'gdrive_auth', 'width=500,height=650,scrollbars=yes');
      if (!popup) {
        flash(false, 'Popup blocked — please allow popups for this page.');
        setConnecting(false);
      }
      // Result comes back via postMessage (see useEffect above)
    } catch (e: any) {
      flash(false, e.message || 'Failed to start Google auth');
      setConnecting(false);
    }
  };

  // ── Upload to Drive ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploading(true);
    try {
      const data = await authedJson(`${API}/api/backup/gdrive/upload`, { method: 'POST' });
      flash(true, `Backed up to Google Drive: ${data.folder}/${data.filename}`);
      loadStatus();
    } catch (e: any) {
      flash(false, e.message || 'Upload failed');
      if (e.message?.includes('session expired')) loadStatus();
    } finally {
      setUploading(false);
    }
  };

  // ── Disconnect Drive ──────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Your existing backups in Drive will not be deleted.')) return;
    try {
      await authedJson(`${API}/api/backup/gdrive/disconnect`, { method: 'DELETE' });
      flash(true, 'Google Drive disconnected.');
      loadStatus();
    } catch (e: any) {
      flash(false, e.message || 'Failed');
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div>
        <h3 className="font-bold text-white text-base mb-1">Backup & Restore</h3>
        <p className="text-zinc-500 text-sm">
          Your entire database (menu, orders, staff, settings) and all food photos live in
          <span className="font-mono text-zinc-300 mx-1">backend/data/restaurant.db</span>
          and the <span className="font-mono text-zinc-300 mx-1">uploads/</span> folder.
          Back these up regularly.
        </p>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
          msg.ok
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}>
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {msg.ok
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            }
          </svg>
          {msg.text}
        </div>
      )}

      {/* ── Option 1: Direct download ── */}
      <Section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Download Backup</h4>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Downloads a <span className="font-mono text-zinc-300">.zip</span> file containing
              your database and all food photos. Save it to a USB drive or anywhere safe.
            </p>
          </div>
          <svg className="w-8 h-8 text-zinc-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          {[
            { icon: '🗄️', label: 'Database', desc: 'All menus, orders, staff, settings' },
            { icon: '🖼️', label: 'Photos',   desc: 'All uploaded food images' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-raised border border-surface-border">
              <span className="text-base">{icon}</span>
              <div>
                <p className="text-white font-semibold">{label}</p>
                <p className="text-zinc-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn btn-brand flex items-center gap-2"
        >
          {downloading
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Preparing download…</>
            : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Download Backup Now</>
          }
        </button>
      </Section>

      {/* ── Option 2: Google Drive ── */}
      <Section>
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Google Drive Backup</h4>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Connect your Google account and back up with one click. Backups are saved to a
              <span className="font-mono text-zinc-300 mx-1">"Restaurant POS Backups"</span>
              folder in your Drive.
            </p>
          </div>
          <svg className="w-8 h-8 text-zinc-600 flex-shrink-0 mt-0.5" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L6.6 25h37.05z" fill="#00ac47"/>
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60.1l5.9 11.5z" fill="#ea4335"/>
            <path d="M43.65 25L57.4 1.2C56 .4 54.45 0 52.9 0H34.4c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/>
            <path d="M60.1 53H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.8c1.55 0 3.1-.4 4.5-1.2z" fill="#2684fc"/>
            <path d="M73.4 25.5L59.65 1.2C58.25.4 56.7 0 55.15 0h-2.25L43.65 25H87.3c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 mt-3 mb-4">
          <Pill ok={!!driveStatus?.connected} label={driveStatus?.connected ? 'Connected' : 'Not connected'} />
          {driveStatus?.last_backup && (
            <span className="text-zinc-500 text-xs">
              Last backup: <span className="text-zinc-300">{timeAgo(driveStatus.last_backup)}</span>
              {driveStatus.last_filename && (
                <span className="text-zinc-600 ml-1">({driveStatus.last_filename})</span>
              )}
            </span>
          )}
        </div>

        {/* Not configured yet — show credential setup */}
        {!driveStatus?.configured && (
          <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-4 mb-4">
            <p className="text-amber-400 text-xs font-semibold mb-1">One-time setup required</p>
            <p className="text-zinc-500 text-xs leading-relaxed mb-3">
              Google Drive requires a free API key from Google Cloud Console.
              This takes about 5 minutes and only needs to be done once.
            </p>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              Open Google Cloud Console
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
            </a>
          </div>
        )}

        {/* Credential entry form */}
        {(!driveStatus?.configured || showCreds) && (
          <div className="rounded-lg bg-surface-raised border border-surface-border p-4 mb-4 space-y-3">
            <p className="text-white text-xs font-semibold">
              {driveStatus?.configured ? 'Update credentials' : 'Enter your Google OAuth credentials'}
            </p>
            <div>
              <label className="label">Client ID</label>
              <input
                className="input font-mono text-xs"
                placeholder="1234567890-abc...apps.googleusercontent.com"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Client Secret</label>
              <input
                className="input font-mono text-xs"
                type="password"
                placeholder="GOCSPX-..."
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
              />
            </div>
            <p className="text-zinc-600 text-[10px] leading-relaxed">
              In Google Cloud Console: Create credentials → OAuth 2.0 Client ID → Application type: Web application →
              Add authorized redirect URI: <span className="font-mono text-zinc-400 select-all">{API}/api/backup/gdrive/callback</span>
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-brand btn-sm"
                onClick={handleSaveCreds}
                disabled={savingCreds || !clientId || !clientSecret}
              >
                {savingCreds ? 'Saving…' : 'Save Credentials'}
              </button>
              {showCreds && (
                <button className="btn btn-sm" onClick={() => setShowCreds(false)}>Cancel</button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!driveStatus?.connected && driveStatus?.configured && (
            <button
              className="btn btn-brand flex items-center gap-2"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting
                ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Waiting for Google…</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>Connect Google Drive</>
              }
            </button>
          )}

          {driveStatus?.connected && (
            <>
              <button
                className="btn btn-brand flex items-center gap-2"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Uploading…</>
                  : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.572 11.095H6.75z" /></svg>Back Up to Drive Now</>
                }
              </button>
              <button className="btn btn-sm" onClick={() => setShowCreds(v => !v)}>
                Update credentials
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>
                Disconnect
              </button>
            </>
          )}
        </div>

        {/* How to restore note */}
        <div className="mt-4 pt-4 border-t border-surface-border">
          <p className="text-zinc-600 text-[10px] leading-relaxed">
            <span className="text-zinc-400 font-semibold">To restore:</span> stop the POS, replace
            <span className="font-mono mx-1">backend/data/restaurant.db</span>
            with the one from the zip, replace the
            <span className="font-mono mx-1">uploads/</span>
            folder, then restart.
          </p>
        </div>
      </Section>

      {/* ── Auto-backup reminder ── */}
      <Section>
        <h4 className="font-bold text-white text-sm mb-2">Backup Reminder</h4>
        <p className="text-zinc-500 text-xs leading-relaxed mb-3">
          We recommend backing up at least once a week. A good habit is to do it
          at the end of each day before closing up.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[
            { freq: 'Daily',   risk: 'Low',    color: 'text-emerald-400', desc: 'Best — never lose more than a day of data' },
            { freq: 'Weekly',  risk: 'Medium', color: 'text-amber-400',   desc: 'Good — lose up to a week if something goes wrong' },
            { freq: 'Monthly', risk: 'High',   color: 'text-red-400',     desc: 'Risky — could lose a month of order history' },
          ].map(({ freq, risk, color, desc }) => (
            <div key={freq} className="p-3 rounded-lg bg-surface-raised border border-surface-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white font-semibold">{freq}</span>
                <span className={`text-[10px] font-bold uppercase ${color}`}>{risk} risk</span>
              </div>
              <p className="text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}