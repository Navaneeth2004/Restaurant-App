/**
 * views/admin/GoogleDriveSection.tsx
 *
 * Google Drive backup configuration and management panel.
 * Extracted from AdminBackup.tsx.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';

const API = process.env.REACT_APP_API_URL || window.location.origin;

// ── Auth helpers ──────────────────────────────────────────────────────────
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
async function authedJson(url: string, opts: RequestInit = {}): Promise<any> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any || {}) };
  const token = await getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers: h });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as any).error || `Error ${r.status}`); }
  return r.json();
}

// ── Constants ─────────────────────────────────────────────────────────────
const SCHEDULES = [
  { key: 'off',   label: 'Off'         },
  { key: '1h',    label: 'Every hour'  },
  { key: '2h',    label: 'Every 2h'   },
  { key: '6h',    label: 'Every 6h'   },
  { key: '12h',   label: 'Every 12h'  },
  { key: 'daily', label: 'Daily'      },
];

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block flex-shrink-0" />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-white px-2 py-1 rounded border border-surface-border hover:border-zinc-600 transition-colors flex-shrink-0"
    >
      {copied
        ? <>
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            <span className="text-emerald-400">Copied</span>
          </>
        : <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
            Copy
          </>
      }
    </button>
  );
}

function GoogleDriveBadge() {
  return (
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
}

// ── Types ─────────────────────────────────────────────────────────────────
interface DriveStatus {
  configured:    boolean;
  connected:     boolean;
  last_backup:   string | null;
  last_filename: string | null;
  folder_name:   string | null;
  schedule:      string;
  redirect_uri:  string;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function GoogleDriveSection() {
  const toast = useToast();
  const [status,        setStatus]        = useState<DriveStatus | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [connecting,    setConnecting]    = useState(false);
  const [savingCreds,   setSavingCreds]   = useState(false);
  const [savingSched,   setSavingSched]   = useState(false);
  const [showCreds,     setShowCreds]     = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);
  const [clientId,      setClientId]      = useState('');
  const [clientSecret,  setClientSecret]  = useState('');
  const [selectedSched, setSelectedSched] = useState('off');

  const popupRef      = useRef<Window | null>(null);
  const popupCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/status`);
      setStatus(d);
      setSelectedSched(d.schedule || 'off');
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Listen for gdrive_connected message from OAuth popup
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data === 'gdrive_connected') {
        setConnecting(false);
        if (popupCheckRef.current) clearInterval(popupCheckRef.current);
        toast('Google Drive connected!', 'success');
        loadStatus();
      }
    };
    window.addEventListener('message', h);
    return () => {
      window.removeEventListener('message', h);
      if (popupCheckRef.current) clearInterval(popupCheckRef.current);
    };
  }, [loadStatus, toast]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/auth`);
      const popup = window.open(d.url, 'gdrive_auth', 'width=500,height=650,scrollbars=yes');
      if (!popup) {
        toast('Popup blocked — allow popups for this page.', 'error');
        setConnecting(false);
        return;
      }
      popupRef.current = popup;
      if (popupCheckRef.current) clearInterval(popupCheckRef.current);
      popupCheckRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckRef.current!);
          popupCheckRef.current = null;
          setConnecting(false);
        }
      }, 500);
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
      setConnecting(false);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const d = await authedJson(`${API}/api/backup/gdrive/upload`, { method: 'POST' });
      toast(`Backed up to Drive — ${d.folder}/${d.filename}`, 'success');
      loadStatus();
    } catch (e: any) {
      toast(e.message || 'Upload failed', 'error');
      if (e.message?.includes('expired')) loadStatus();
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) { toast('Both fields are required.', 'error'); return; }
    setSavingCreds(true);
    try {
      await authedJson(`${API}/api/backup/gdrive/credentials`, {
        method: 'PUT',
        body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
      });
      toast('Credentials saved. Now click "Connect Google Drive".', 'success');
      setShowCreds(false); setClientId(''); setClientSecret('');
      loadStatus();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSched(true);
    try {
      await authedJson(`${API}/api/backup/gdrive/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ schedule: selectedSched }),
      });
      const label = SCHEDULES.find(s => s.key === selectedSched)?.label;
      toast(selectedSched === 'off' ? 'Auto-backup disabled.' : `Auto-backup: ${label}`, 'success');
      loadStatus();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingSched(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Backups in Drive will not be deleted.')) return;
    try {
      await authedJson(`${API}/api/backup/gdrive/disconnect`, { method: 'DELETE' });
      toast('Disconnected.', 'success');
      loadStatus();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const schedLabel   = SCHEDULES.find(s => s.key === (status?.schedule || 'off'))?.label || 'Off';
  const redirectUri  = status?.redirect_uri || `${window.location.origin}/api/backup/gdrive/callback`;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-white text-sm font-semibold">Google Drive Backup</p>
          <GoogleDriveBadge />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status?.connected
            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Connected
              </span>
            : status !== null
              ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />Not connected
                </span>
              : null
          }
          {status?.last_backup && (
            <span className="text-zinc-600 text-xs">
              Last: <span className="text-zinc-400">{timeAgo(status.last_backup)}</span>
            </span>
          )}
          {status?.connected && status.schedule !== 'off' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/25 text-brand-400">
              Auto: {schedLabel}
            </span>
          )}
        </div>
      </div>

      {/* Setup guide (shown when not connected and creds not entered) */}
      {status !== null && !status.connected && !showCreds && (
        <div className="p-4 border-b border-surface-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-300 text-xs font-semibold">Setup Guide — Google Drive Backup</p>
            <button
              onClick={() => setShowDriveGuide(g => !g)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              {showDriveGuide ? 'Hide' : 'Show steps'}
              <svg className={`w-3 h-3 transition-transform ${showDriveGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed mb-3">
            Needs a free Google Cloud OAuth key — takes about 5 minutes, done once.
          </p>

          {showDriveGuide && (
            <div className="space-y-3 mb-4">
              {[
                { n: 1, title: 'Open Google Cloud Console',     body: <>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-brand-400 underline underline-offset-2">console.cloud.google.com</a>. Sign in with your Google account.</> },
                { n: 2, title: 'Create a new project',          body: <>Click the project dropdown → <span className="text-zinc-300 font-medium">New Project</span>. Name it anything.</> },
                { n: 3, title: 'Enable the Google Drive API',   body: <>Go to <span className="text-zinc-300 font-medium">APIs &amp; Services → Library</span>. Search <span className="font-mono text-zinc-300">Google Drive API</span> and enable it.</> },
                { n: 4, title: 'Configure OAuth consent screen', body: <>Go to <span className="text-zinc-300 font-medium">OAuth consent screen</span>. Choose External, fill app name, add your email as test user.</> },
                { n: 5, title: 'Create OAuth credentials',      body: <>Go to <span className="text-zinc-300 font-medium">Credentials → + Create → OAuth 2.0 Client ID</span>. Set type to Web application. Add the redirect URI below.</> },
                { n: 6, title: 'Copy Client ID and Secret',     body: <>After saving, copy the <span className="text-zinc-300 font-medium">Client ID</span> and <span className="text-zinc-300 font-medium">Client Secret</span> into the form below.</> },
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
                <p className="text-zinc-500 text-xs mb-1.5">Your redirect URI (paste into Google Console — Step 5):</p>
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
            Set up credentials
          </button>
        </div>
      )}

      {/* Credentials form */}
      {showCreds && (
        <div className="p-4 border-b border-surface-border space-y-3">
          <p className="text-white text-xs font-semibold">
            {status?.configured ? 'Update credentials' : 'Enter OAuth credentials'}
          </p>
          <div>
            <label className="label">Client ID</label>
            <input className="input font-mono text-xs" placeholder="1234567890-abc...apps.googleusercontent.com"
              value={clientId} onChange={e => setClientId(e.target.value)} />
          </div>
          <div>
            <label className="label">Client Secret</label>
            <input className="input font-mono text-xs" type="password" placeholder="GOCSPX-..."
              value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-brand btn-sm" onClick={handleSaveCreds}
              disabled={savingCreds || !clientId || !clientSecret}>
              {savingCreds ? <><Spinner />Saving…</> : 'Save Credentials'}
            </button>
            <button className="btn btn-sm" onClick={() => setShowCreds(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Connect button (configured but not yet connected) */}
      {status?.configured && !status.connected && !showCreds && (
        <div className="p-4 border-b border-surface-border">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-brand btn-sm flex items-center gap-2" onClick={handleConnect} disabled={connecting}>
              {connecting
                ? <><Spinner />Waiting for Google…</>
                : <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.572 11.095H6.75z" />
                    </svg>
                    Connect Google Drive
                  </>
              }
            </button>
          </div>
        </div>
      )}

      {/* Back up now (connected) */}
      {status?.connected && (
        <div className="p-4 border-b border-surface-border">
          <p className="text-zinc-500 text-xs mb-3">
            Saves to <span className="text-zinc-300">Restaurant POS Backups / restaurant_pos_backup.zip</span> — overwrites each time.
          </p>
          <button className="btn btn-brand btn-sm flex items-center gap-2" onClick={handleUpload} disabled={uploading}>
            {uploading
              ? <><Spinner />Uploading…</>
              : <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.572 11.095H6.75z" />
                  </svg>
                  Back Up to Drive Now
                </>
            }
          </button>
        </div>
      )}

      {/* Schedule (only shown when configured) */}
      {status?.configured && (
        <div className="p-4 border-b border-surface-border">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white text-xs font-semibold">Drive Auto-backup Schedule</p>
          </div>
          {!status.connected && (
            <p className="text-zinc-600 text-xs mb-2">Connect Google Drive first to use auto-backup.</p>
          )}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {SCHEDULES.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedSched(s.key)}
                disabled={!status.connected}
                className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                  selectedSched === s.key
                    ? 'bg-brand-500 border-brand-600 text-white'
                    : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-sm flex items-center gap-2"
            onClick={handleSaveSchedule}
            disabled={savingSched || selectedSched === status.schedule || !status.connected}
          >
            {savingSched ? <><Spinner />Saving…</> : 'Save Schedule'}
          </button>
        </div>
      )}

      {/* Footer actions (connected) */}
      {status?.connected && (
        <div className="p-4 flex flex-wrap gap-2">
          <button className="btn btn-sm" onClick={() => setShowCreds(true)}>Update credentials</button>
          <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>Disconnect Drive</button>
        </div>
      )}
    </div>
  );
}