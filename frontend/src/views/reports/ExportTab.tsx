import React, { useState } from 'react';
import { useAdminLock } from '../../context/AdminLockContext';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;

async function getToken(): Promise<string | null> {
  try {
    const res  = await fetch(`${API_ORIGIN}/api/auth/token`);
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const token = await getToken();
  const res   = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Export failed');
  }
  const blob    = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = blobUrl;
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

function Status({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className={`mt-3 flex items-center gap-2 text-xs ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {ok
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        }
      </svg>
      {msg}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function PinLockNote() {
  return (
    <p className="text-zinc-600 text-[10px] mt-3 flex items-center gap-1">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      PIN required to download
    </p>
  );
}

// ── Detailed Report (CSV / JSON) ───────────────────────────────────────────

function OurFormatSection() {
  const today = new Date().toISOString().split('T')[0];
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [loading, setLoading] = useState<'csv' | 'json' | null>(null);
  const [status,  setStatus]  = useState<{ ok: boolean; msg: string } | null>(null);
  const { requirePin, config: lockConfig } = useAdminLock();

  const label = () => {
    if (from && to) return `${from}_to_${to}`;
    if (from)       return `from_${from}`;
    if (to)         return `to_${to}`;
    return 'all';
  };

  const doRun = async (fmt: 'csv' | 'json') => {
    setLoading(fmt);
    setStatus(null);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const filename = `sales_${label()}.${fmt}`;
      await downloadFile(`${API_ORIGIN}/api/export/revenue?${params}`, filename);
      setStatus({ ok: true, msg: `Downloaded ${filename}` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message || 'Export failed' });
    } finally {
      setLoading(null);
    }
  };

  const run = (fmt: 'csv' | 'json') => {
    if (!lockConfig.enabled) { doRun(fmt); return; }
    requirePin(() => doRun(fmt), 'Download Report', 'Enter admin PIN to export report');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h4 className="font-semibold text-white text-sm mb-1">Detailed Report</h4>
      <p className="text-zinc-500 text-xs mb-4">
        Full breakdown — daily totals, top items, tax, and every order. Leave dates blank to export everything.
      </p>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-44" value={from} max={today}
            onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-44" value={to} max={today}
            onChange={e => setTo(e.target.value)} />
        </div>
        {(from || to) && (
          <button className="btn btn-sm text-xs mb-0.5" onClick={() => { setFrom(''); setTo(''); }}>
            Clear
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-4 flex-wrap">
        <button className="btn btn-brand flex items-center gap-2"
          onClick={() => run('csv')} disabled={loading !== null}>
          {loading === 'csv'
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Export CSV</>
          }
        </button>
        <button className="btn flex items-center gap-2 text-xs"
          onClick={() => run('json')} disabled={loading !== null}>
          {loading === 'json'
            ? <><span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Export JSON</>
          }
        </button>
      </div>

      {status && <Status ok={status.ok} msg={status.msg} />}
      {lockConfig.enabled && <PinLockNote />}

      <div className="mt-4 pt-4 border-t border-surface-border grid grid-cols-2 sm:grid-cols-4 gap-2">
        {['Summary block', 'Tax collected', 'Avg order value', 'Items sold',
          'Revenue excl. tax', 'Daily breakdown', 'Top items ranking', 'Full order detail'].map(f => (
          <div key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vyapar Items Export ────────────────────────────────────────────────────

function VyaparItemsSection() {
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState<{ ok: boolean; msg: string } | null>(null);
  const { requirePin, config: lockConfig } = useAdminLock();

  const doRun = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const filename = `vyapar_items_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadFile(`${API_ORIGIN}/api/export/vyapar-items`, filename);
      setStatus({ ok: true, msg: `Downloaded ${filename}` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message || 'Export failed' });
    } finally {
      setLoading(false);
    }
  };

  const run = () => {
    if (!lockConfig.enabled) { doRun(); return; }
    requirePin(doRun, 'Download Vyapar Items', 'Enter admin PIN to export items');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h4 className="font-semibold text-white text-sm mb-1">Vyapar — Item Import</h4>
      <p className="text-zinc-500 text-xs mb-4">
        Exports your full menu as an <span className="text-zinc-300">.xlsx</span> file ready
        to import into Vyapar via{' '}
        <span className="text-zinc-300">Utilities → Import Items → Import From Excel</span>.
        Do this once to set up your item catalogue in Vyapar.
      </p>

      <button className="btn btn-brand flex items-center gap-2" onClick={run} disabled={loading}>
        {loading
          ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
          : <><DownloadIcon />Download Items .xlsx</>
        }
      </button>

      {status && <Status ok={status.ok} msg={status.msg} />}
      {lockConfig.enabled && <PinLockNote />}

      <div className="mt-4 pt-4 border-t border-surface-border">
        <p className="text-zinc-600 text-[10px] mb-2 uppercase tracking-wider font-semibold">Columns included / excluded</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Item name',           ok: true  },
            { label: 'Item code (MI-{id})', ok: true  },
            { label: 'Category',            ok: true  },
            { label: 'Sale price',          ok: true  },
            { label: 'Tax Rate',            ok: true  },
            { label: 'Inclusive Of Tax',    ok: true  },
            { label: 'HSN',                 ok: false },
            { label: 'Purchase price',      ok: false },
            { label: 'Discount',            ok: false },
            { label: 'Stock quantities',    ok: false },
            { label: 'Item Location',       ok: false },
            { label: 'Units / Conversion',  ok: false },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              {ok ? (
                <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Export Tab ────────────────────────────────────────────────────────

export default function ExportTab() {
  return (
    <div className="space-y-5">
      <OurFormatSection />
      <VyaparItemsSection />
    </div>
  );
}