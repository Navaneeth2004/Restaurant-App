import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

// ── Error capture: hook into console.error + window.onerror globally ──────
const _capturedErrors: string[] = [];
const _origError = console.error.bind(console);
console.error = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  _capturedErrors.push(`[${new Date().toISOString()}] ${msg}`);
  if (_capturedErrors.length > 30) _capturedErrors.shift(); // keep last 30
  _origError(...args);
};
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    _capturedErrors.push(`[${new Date().toISOString()}] Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    _capturedErrors.push(`[${new Date().toISOString()}] UnhandledPromise: ${e.reason}`);
  });
}

// ── Auth token helper ─────────────────────────────────────────────────────
let _tok: string | null = null;
async function getToken(): Promise<string | null> {
  if (_tok !== null) return _tok;
  try {
    const r = await fetch(`${API_BASE}/api/auth/token`);
    const d = await r.json();
    _tok = d.token ?? null;
    return _tok;
  } catch { return null; }
}
async function authedPost(url: string, body: any): Promise<Response> {
  const token = await getToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
}

// ── Diagnostics collector ─────────────────────────────────────────────────
function collectDiagnostics(user: any, currentView: string, sessionStart: Date) {
  const ua = navigator.userAgent;

  // Parse browser name + version
  let browser = 'Unknown';
  let browserVersion = '';
  const bMatches: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Safari\/([\d.]+)/, 'Safari'],
  ];
  for (const [re, name] of bMatches) {
    const m = ua.match(re);
    if (m) { browser = name; browserVersion = m[1]; break; }
  }

  // Parse OS
  let os = 'Unknown';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X ([\d_]+)/.test(ua)) os = `macOS ${ua.match(/Mac OS X ([\d_]+)/)![1].replace(/_/g, '.')}`;
  else if (/Android ([\d.]+)/.test(ua)) os = `Android ${ua.match(/Android ([\d.]+)/)![1]}`;
  else if (/iPhone OS ([\d_]+)/.test(ua)) os = `iOS ${ua.match(/iPhone OS ([\d_]+)/)![1].replace(/_/g, '.')}`;
  else if (/Linux/.test(ua)) os = 'Linux';

  // Device type
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|tablet/i.test(ua);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';

  // Network
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  // Performance
  const perf = window.performance;
  const timing = perf?.timing;
  let pageLoad: number | null = null;
  let domReady: number | null = null;
  if (timing && timing.loadEventEnd && timing.navigationStart) {
    pageLoad = Math.round(timing.loadEventEnd - timing.navigationStart);
    domReady = Math.round(timing.domContentLoadedEventEnd - timing.navigationStart);
  }

  const mem = (performance as any).memory;

  const sessionDurationMs = Date.now() - sessionStart.getTime();
  const sessionMins = Math.floor(sessionDurationMs / 60000);
  const sessionSecs = Math.floor((sessionDurationMs % 60000) / 1000);

  return {
    appContext: {
      currentView,
      userRole: user?.role || 'unknown',
      userName: user?.name || 'unknown',
      userId: user?.id || 'unknown',
      selectedTable: null, // could be passed as prop
      url: window.location.href,
      sessionDuration: `${sessionMins}m ${sessionSecs}s`,
      sessionStart: sessionStart.toISOString(),
      timestamp: new Date().toISOString(),
    },
    device: {
      browser,
      browserVersion,
      os,
      type: deviceType,
      userAgent: ua,
      screen: `${screen.width}×${screen.height} (${screen.colorDepth}bit)`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: navigator.languages?.join(', '),
      memory: (nav.deviceMemory) || null,
      cores: navigator.hardwareConcurrency || null,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    },
    network: conn ? {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData,
    } : null,
    performance: {
      pageLoad,
      domReady,
      memoryUsed: mem ? `${Math.round(mem.usedJSHeapSize / 1048576)}MB / ${Math.round(mem.jsHeapSizeLimit / 1048576)}MB` : null,
    },
    consoleErrors: [..._capturedErrors],
    socketConnected: !!(window as any).__pos_socket_connected,
  };
}

// ── Severity config ───────────────────────────────────────────────────────
const SEVERITIES = [
  { key: 'low',      label: 'Low',      desc: 'Minor annoyance, workaround exists',          color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
  { key: 'medium',   label: 'Medium',   desc: 'Feature broken, affects daily use',           color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  { key: 'high',     label: 'High',     desc: 'Major feature unusable or data wrong',        color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  { key: 'critical', label: 'Critical', desc: 'App crashed, orders lost, data corrupted',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.3)' },
];

const CATEGORIES = [
  { key: 'orders',    label: 'Orders & Kitchen',  icon: '🍽️' },
  { key: 'billing',   label: 'Billing & Payment', icon: '💳' },
  { key: 'menu',      label: 'Menu & Categories', icon: '📋' },
  { key: 'tables',    label: 'Tables & Floor',    icon: '🪑' },
  { key: 'staff',     label: 'Staff & Login',     icon: '👤' },
  { key: 'reports',   label: 'Reports & Export',  icon: '📊' },
  { key: 'settings',  label: 'Settings & Backup', icon: '⚙️' },
  { key: 'display',   label: 'Display / UI',      icon: '🖥️' },
  { key: 'other',     label: 'Other',             icon: '🔧' },
];

// ── Step recorder component ───────────────────────────────────────────────
function StepsRecorder({ steps, onChange }: { steps: string[]; onChange: (s: string[]) => void }) {
  const [current, setCurrent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const t = current.trim();
    if (!t) return;
    onChange([...steps, t]);
    setCurrent('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  };

  return (
    <div>
      <div className="space-y-2 mb-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5 group">
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <span className="flex-1 text-zinc-200 text-sm leading-relaxed pt-0.5">{step}</span>
            <button
              onClick={() => remove(i)}
              className="w-5 h-5 rounded flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="input flex-1 text-sm"
          placeholder={steps.length === 0 ? 'e.g. "Tapped Table 3 then added items"' : 'Add next step…'}
          value={current}
          onChange={e => setCurrent(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          onClick={add}
          disabled={!current.trim()}
          className="btn btn-sm flex-shrink-0 disabled:opacity-30"
        >
          Add
        </button>
      </div>
      <p className="text-zinc-600 text-[10px] mt-1.5">Press Enter to add each step. These help the developer reproduce the issue.</p>
    </div>
  );
}

// ── Screenshot capture ────────────────────────────────────────────────────
async function captureScreenshot(): Promise<string | null> {
  try {
    // Use html2canvas-like approach via getDisplayMedia
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ── Diagnostics display ───────────────────────────────────────────────────
function DiagnosticsPreview({ diag }: { diag: ReturnType<typeof collectDiagnostics> }) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: 'Browser',      value: `${diag.device.browser} ${diag.device.browserVersion}` },
    { label: 'OS',           value: diag.device.os },
    { label: 'Device',       value: `${diag.device.type} · ${diag.device.screen}` },
    { label: 'Viewport',     value: diag.device.viewport },
    { label: 'Timezone',     value: diag.device.timezone },
    { label: 'View',         value: diag.appContext.currentView },
    { label: 'Role',         value: diag.appContext.userRole },
    { label: 'Session',      value: diag.appContext.sessionDuration },
    { label: 'Errors caught',value: String(diag.consoleErrors.length) },
    { label: 'Online',       value: diag.device.onLine ? 'Yes' : 'No' },
  ];

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-card/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-300 text-sm font-semibold">Auto-collected diagnostics</span>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {items.length} data points + {diag.consoleErrors.length} errors
          </span>
        </div>
        <svg className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="border-t border-surface-border px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mb-3">
            {items.map(({ label, value }) => (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
                <p className="text-xs text-zinc-300 font-medium truncate">{value || '—'}</p>
              </div>
            ))}
          </div>
          {diag.consoleErrors.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-500 mb-1.5">Captured Errors ({diag.consoleErrors.length})</p>
              <div className="bg-zinc-900 rounded-lg p-2.5 max-h-32 overflow-y-auto">
                {diag.consoleErrors.map((err, i) => (
                  <p key={i} className="text-[10px] font-mono text-red-400 leading-relaxed">{err}</p>
                ))}
              </div>
            </div>
          )}
          <p className="text-zinc-700 text-[10px] mt-2">All of this is sent with your report automatically. You don't need to describe your device.</p>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────
interface Props {
  currentView?: string;
}

export default function BugReportView({ currentView = 'unknown' }: Props) {
  const { user } = useAuth();
  const settings = useSettings();
  const toast = useToast();

  const sessionStartRef = useRef(new Date());
  const [step, setStep] = useState<'form' | 'sent'>('form');

  // Form state
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [steps,       setSteps]       = useState<string[]>([]);
  const [severity,    setSeverity]    = useState('medium');
  const [category,    setCategory]    = useState('');
  const [screenshot,  setScreenshot]  = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  // Diagnostics — refreshed on mount
  const [diagnostics, setDiagnostics] = useState<ReturnType<typeof collectDiagnostics> | null>(null);
  useEffect(() => {
    const diag = collectDiagnostics(user, currentView, sessionStartRef.current);
    setDiagnostics(diag);
  }, [user, currentView]);

  const handleScreenshot = async () => {
    const result = await captureScreenshot();
    if (result) {
      setScreenshot(result);
      toast('Screenshot captured', 'success');
    } else {
      toast('Could not capture screenshot — your browser may not support this or permission was denied', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setScreenshot(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Please enter a title for the bug.'); return; }
    if (!description.trim()) { setError('Please describe what went wrong.'); return; }
    if (!category) { setError('Please select a category.'); return; }
    setError('');
    setSubmitting(true);

    // Refresh diagnostics right before sending
    const freshDiag = collectDiagnostics(user, currentView, sessionStartRef.current);

    try {
      const res = await authedPost(`${API_BASE}/api/bug-report`, {
        title:       title.trim(),
        description: description.trim(),
        steps,
        severity,
        category,
        diagnostics: freshDiag,
        screenshot,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setStep('sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setTitle(''); setDescription(''); setSteps([]); setSeverity('medium');
    setCategory(''); setScreenshot(null); setError(''); setStep('form');
  };

  const selectedSev = SEVERITIES.find(s => s.key === severity)!;

  if (step === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
          <svg className="w-9 h-9 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
          </svg>
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Report sent!</h2>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mb-1">
          Your bug report was delivered to the developer with full diagnostics.
        </p>
        <p className="text-zinc-600 text-xs max-w-xs mb-8">
          The developer will have your browser details, errors, and device info — you don't need to send anything else.
        </p>
        <button onClick={reset} className="btn btn-brand px-6">
          Report another issue
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-surface-border bg-surface-card/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-white text-sm leading-tight">Report a Bug</h2>
            <p className="text-zinc-500 text-xs">Device info and errors are collected automatically — just describe what happened</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 space-y-5">

          {/* Diagnostics preview */}
          {diagnostics && <DiagnosticsPreview diag={diagnostics} />}

          {/* Severity */}
          <div>
            <label className="label mb-2">How bad is it?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEVERITIES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSeverity(s.key)}
                  className="text-left p-3 rounded-xl border transition-all"
                  style={{
                    border: `1.5px solid ${severity === s.key ? s.border : '#27272a'}`,
                    background: severity === s.key ? s.bg : 'transparent',
                  }}
                >
                  <p style={{ color: s.color }} className="text-xs font-bold mb-0.5">{s.label}</p>
                  <p className="text-zinc-500 text-[10px] leading-tight">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label mb-2">Which part of the app?</label>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-xs font-semibold ${
                    category === c.key
                      ? 'bg-brand-500/15 border-brand-500/50 text-brand-400'
                      : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
                  }`}
                >
                  <span className="text-sm flex-shrink-0">{c.icon}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="label">Bug title <span className="text-red-400">*</span></label>
            <input
              className="input"
              placeholder='e.g. "Order disappears after adding items to Table 3"'
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
            />
            <p className="text-zinc-700 text-[10px] mt-1">A clear, specific title helps the developer find and fix it faster.</p>
          </div>

          {/* Description */}
          <div>
            <label className="label">What went wrong? <span className="text-red-400">*</span></label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Describe what you expected to happen and what actually happened. Don't worry about technical details — just tell the story."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Steps */}
          <div>
            <label className="label mb-2">Steps to reproduce <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional but very helpful)</span></label>
            <StepsRecorder steps={steps} onChange={setSteps} />
          </div>

          {/* Screenshot */}
          <div>
            <label className="label mb-2">Screenshot <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span></label>
            {screenshot ? (
              <div className="relative rounded-xl overflow-hidden border border-surface-border">
                <img src={screenshot} alt="Screenshot" className="w-full max-h-48 object-contain bg-zinc-900" />
                <button
                  onClick={() => setScreenshot(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-red-500/70 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div className="px-3 py-2 bg-surface-raised border-t border-surface-border">
                  <p className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                    Screenshot attached
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleScreenshot}
                  className="btn btn-sm flex items-center gap-2 flex-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"/>
                  </svg>
                  Capture screen
                </button>
                <label className="btn btn-sm flex items-center gap-2 cursor-pointer flex-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                  </svg>
                  Upload image
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
              <p className="text-red-400 text-sm leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="pb-6">
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !description.trim() || !category}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: submitting ? '#6b7280' : selectedSev.color,
                border: `1.5px solid ${selectedSev.border}`,
                color: '#fff',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending report…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                  </svg>
                  Send Bug Report
                </span>
              )}
            </button>
            <p className="text-zinc-600 text-[10px] text-center mt-2.5 leading-relaxed">
              Your report will include browser info, errors, and device details — captured automatically.<br/>
              {screenshot ? 'Screenshot will be attached.' : 'No personal data beyond your name and role is included.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}