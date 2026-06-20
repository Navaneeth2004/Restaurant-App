import React, { useState } from 'react';
import { useAdminLock } from '../../context/AdminLockContext';
import { useToast } from '../../context/ToastContext';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;

// FIX: previously used new Date().toISOString().split('T')[0], which
// converts to UTC first. On a server/browser running UTC while the user
// is in IST (UTC+5:30), or vice versa, this silently returns YESTERDAY's
// or TOMORROW's date depending on time of day — exactly the "19 to 20"
// mismatch reported. Build the date string from LOCAL components instead,
// matching what a <input type="date"> picker shows the user.
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns an error string if the range is invalid, else ''. */
function validateRange(from: string, to: string): string {
  if (from && to && from > to) {
    return `"From" date (${from}) is after "To" date (${to}). Please fix the range.`;
  }
  return '';
}

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

function DateRangeError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs mt-3">
      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {message}
    </div>
  );
}

// ── Detailed Report (CSV / JSON) ───────────────────────────────────────────

function OurFormatSection() {
  const today = todayStr();
  const [from,    setFrom]    = useState(today);
  const [to,      setTo]      = useState(today);
  const [loading, setLoading] = useState<'csv' | 'json' | null>(null);
  const { requirePin, config: lockConfig } = useAdminLock();
  const toast = useToast();

  const dateError = validateRange(from, to);

  const label = () => {
    if (from && to) return `${from}_to_${to}`;
    if (from)       return `from_${from}`;
    if (to)         return `to_${to}`;
    return 'all';
  };

  const doRun = async (fmt: 'csv' | 'json') => {
    setLoading(fmt);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const filename = `sales_${label()}.${fmt}`;
      await downloadFile(`${API_ORIGIN}/api/export/revenue?${params}`, filename);
      toast(`Downloaded ${filename}`, 'success');
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setLoading(null);
    }
  };

  const run = (fmt: 'csv' | 'json') => {
    if (dateError) { toast(dateError, 'error'); return; }
    if (!lockConfig.enabled) { doRun(fmt); return; }
    requirePin(() => doRun(fmt), 'Download Report', 'Enter admin PIN to export report');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h4 className="font-semibold text-white text-sm mb-1">Detailed Report</h4>
      <p className="text-zinc-500 text-xs mb-4">
        Full breakdown — daily totals, top items, tax, and every order. Defaults to today.
      </p>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">From</label>
          <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
            value={from} max={today}
            onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
            value={to} max={today}
            onChange={e => setTo(e.target.value)} />
        </div>
        {/* FIX: removed "Clear (all time)" — not needed; "Today" resets the range */}
        <button className="btn btn-sm text-xs mb-0.5" onClick={() => { setFrom(today); setTo(today); }}>
          Today
        </button>
      </div>

      <DateRangeError message={dateError} />

      <div className="flex gap-2 mt-4 flex-wrap">
        <button className="btn btn-brand flex items-center gap-2"
          onClick={() => run('csv')} disabled={loading !== null || !!dateError}>
          {loading === 'csv'
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Export CSV</>
          }
        </button>
        <button className="btn flex items-center gap-2 text-xs"
          onClick={() => run('json')} disabled={loading !== null || !!dateError}>
          {loading === 'json'
            ? <><span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Export JSON</>
          }
        </button>
      </div>

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

// ── Vyapar TaxOne Sales Export ────────────────────────────────────────────

function VyaparSalesSection() {
  const today = todayStr();
  const [from,    setFrom]    = useState(today);
  const [to,      setTo]      = useState(today);
  const [loading, setLoading] = useState<'without' | 'with' | null>(null);
  const { requirePin, config: lockConfig } = useAdminLock();
  const toast = useToast();

  const dateError = validateRange(from, to);

  const label = () => {
    if (from && to) return `${from}_to_${to}`;
    if (from)       return `from_${from}`;
    if (to)         return `to_${to}`;
    return 'all';
  };

  const doRun = async (type: 'without' | 'with') => {
    setLoading(type);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const suffix   = type === 'with' ? 'with-item' : 'without-item';
      const prefix   = type === 'with' ? 'sales_vyapar_items' : 'sales_vyapar';
      const filename = `${prefix}_${label()}.xlsx`;
      await downloadFile(`${API_ORIGIN}/api/export/vyapar-sales/${suffix}?${params}`, filename);
      toast(`Downloaded ${filename}`, 'success');
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setLoading(null);
    }
  };

  const run = (type: 'without' | 'with') => {
    if (dateError) { toast(dateError, 'error'); return; }
    if (!lockConfig.enabled) { doRun(type); return; }
    requirePin(() => doRun(type), 'Download Vyapar Sales', 'Enter admin PIN to export sales');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h4 className="font-semibold text-white text-sm mb-1">Vyapar TaxOne — Sales Upload</h4>
      <p className="text-zinc-500 text-xs mb-4">
        Exports closed orders as an <span className="text-zinc-300">.xlsx</span> file ready
        for <span className="text-zinc-300">Bulk Upload → Sales</span> in Vyapar TaxOne.
        Choose <span className="text-zinc-300">Without Item</span> for a simple one-row-per-order
        accounting invoice, or <span className="text-zinc-300">With Item</span> for full line-item detail.
        Defaults to today.
      </p>

      <div className="flex items-end gap-3 flex-wrap mb-4">
        <div>
          <label className="label">From</label>
          <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
            value={from} max={today}
            onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
            value={to} max={today}
            onChange={e => setTo(e.target.value)} />
        </div>
        {/* FIX: removed "Clear (all time)" */}
        <button className="btn btn-sm text-xs mb-0.5" onClick={() => { setFrom(today); setTo(today); }}>
          Today
        </button>
      </div>

      <DateRangeError message={dateError} />

      <div className="flex gap-2 flex-wrap mt-4">
        <button
          className="btn btn-brand flex items-center gap-2"
          onClick={() => run('without')}
          disabled={loading !== null || !!dateError}
        >
          {loading === 'without'
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Without Item</>
          }
        </button>
        <button
          className="btn flex items-center gap-2 text-xs"
          onClick={() => run('with')}
          disabled={loading !== null || !!dateError}
        >
          {loading === 'with'
            ? <><span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />With Item</>
          }
        </button>
      </div>

      {lockConfig.enabled && <PinLockNote />}

      <div className="mt-4 pt-4 border-t border-surface-border">
        <p className="text-zinc-600 text-[10px] mb-2 uppercase tracking-wider font-semibold">Columns exported</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Reference No (Order ID)',   ok: true              },
            { label: 'Invoice Date (DD/MM/YYYY)', ok: true              },
            { label: 'Party (Walk-in Customer)',  ok: true              },
            { label: 'Place of Supply',           ok: true              },
            { label: 'Amount (pre-tax)',           ok: true              },
            { label: 'SGST / CGST / IGST',        ok: true              },
            { label: 'Total Amount (incl. tax)',   ok: true              },
            { label: 'Item name & qty',            ok: true,  note: 'With Item only' },
            { label: 'Customer GSTIN',             ok: false             },
            { label: 'Customer name / address',    ok: false             },
          ].map(({ label, ok, note }) => (
            <div key={label} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
              {ok ? (
                <svg className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span>{label}{note ? <span className="text-zinc-600 ml-1">({note})</span> : ''}</span>
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
      <VyaparSalesSection />
    </div>
  );
}