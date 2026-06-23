import React, { useState, useEffect, useCallback } from 'react';
import { useAdminLock } from '../../context/AdminLockContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { authedJson } from '../../utils/authedFetch';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthStartStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function quarterStartStr(): string {
  const d = new Date();
  const m = d.getMonth(); // 0-indexed
  const quarterStartMonth = Math.floor(m / 3) * 3;
  const y = d.getFullYear();
  return `${y}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
}

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

// ── GSTR-3B on-screen summary ──────────────────────────────────────────────

function Gstr3bSummary({ from, to }: { from: string; to: string }) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const toast    = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const d = await authedJson(`${API_ORIGIN}/api/export/gst/gstr3b?${params}`);
      setData(d);
    } catch (e: any) {
      setError(e.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const copyField = (label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => toast(`Copied: ${label}`, 'success'));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-zinc-500 text-xs">
        <span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
        Loading GSTR-3B summary…
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 text-xs py-2">{error}</p>;
  }

  if (!data) return null;

  const o = data.outward_taxable;

  const fields = [
    { table: '3.1(a)', label: 'Outward taxable supplies (other than zero rated)', taxable: o.total_taxable_value, igst: o.integrated_tax, cgst: o.central_tax, sgst: o.state_ut_tax },
  ];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-zinc-300 text-xs font-semibold">GSTR-3B Summary</p>
        <span className="text-[10px] text-zinc-600">Click any value to copy it</span>
      </div>

      {/* Header info */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { l: 'GSTIN', v: data.gstin || '—' },
          { l: 'Legal Name', v: data.legal_name || '—' },
          { l: 'Tax Rate', v: `${data.tax_rate}%` },
          { l: 'Orders', v: String(data.order_count) },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-lg bg-surface-raised border border-surface-border px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{l}</p>
            <p className="text-white text-xs font-mono font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {/* Table 3.1 */}
      <div className="rounded-lg border border-surface-border overflow-hidden">
        <div className="bg-surface-raised px-3 py-2 border-b border-surface-border">
          <p className="text-zinc-300 text-xs font-semibold">Table 3.1 — Outward Taxable Supplies</p>
          <p className="text-zinc-600 text-[10px]">Enter these values on the GST portal under GSTR-3B → 3.1(a)</p>
        </div>
        <div className="divide-y divide-surface-border">
          {[
            { label: 'Total Taxable Value (pre-tax)', value: o.total_taxable_value },
            { label: 'Integrated Tax (IGST)', value: o.integrated_tax },
            { label: 'Central Tax (CGST)', value: o.central_tax },
            { label: 'State/UT Tax (SGST)', value: o.state_ut_tax },
            { label: 'Cess', value: 0 },
          ].map(({ label, value }) => (
            <button
              key={label}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-raised transition-colors text-left group"
              onClick={() => copyField(label, value.toFixed(2))}
            >
              <span className="text-zinc-400 text-xs">{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white text-sm font-semibold">{sym}{value.toFixed(2)}</span>
                <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Table 4 — ITC */}
      <div className="rounded-lg border border-surface-border overflow-hidden">
        <div className="bg-surface-raised px-3 py-2 border-b border-surface-border">
          <p className="text-zinc-300 text-xs font-semibold">Table 4 — Eligible ITC</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-zinc-500 text-xs leading-relaxed">{data.itc_claimed.note}</p>
          <p className="text-zinc-600 text-[10px] mt-1.5">Enter ₹0 for all ITC fields in Table 4 on the portal.</p>
        </div>
      </div>

      {/* Table 6.1 — Tax paid */}
      <div className="rounded-lg border border-surface-border overflow-hidden">
        <div className="bg-surface-raised px-3 py-2 border-b border-surface-border">
          <p className="text-zinc-300 text-xs font-semibold">Table 6.1 — Tax Paid</p>
          <p className="text-zinc-600 text-[10px]">Same as 3.1 amounts above — enter under "Tax paid through cash/ITC" on the portal.</p>
        </div>
        <div className="divide-y divide-surface-border">
          {[
            { label: 'Integrated Tax (IGST)', value: data.tax_paid.integrated_tax },
            { label: 'Central Tax (CGST)', value: data.tax_paid.central_tax },
            { label: 'State/UT Tax (SGST)', value: data.tax_paid.state_ut_tax },
          ].map(({ label, value }) => (
            <button
              key={label}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-raised transition-colors text-left group"
              onClick={() => copyField(label, value.toFixed(2))}
            >
              <span className="text-zinc-400 text-xs">{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white text-sm font-semibold">{sym}{value.toFixed(2)}</span>
                <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-brand-500/8 border border-brand-500/20 px-3 py-2.5">
        <p className="text-brand-400 text-xs font-semibold mb-0.5">How to use this</p>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Log into <span className="text-zinc-300">gst.gov.in</span> → File Returns → GSTR-3B → enter the values above.
          For GSTR-1, download the JSON below and upload it via <span className="text-zinc-300">File Returns → GSTR-1 → Upload JSON.</span>
        </p>
      </div>
    </div>
  );
}

// ── GST Filing Section ─────────────────────────────────────────────────────

function GstFilingSection() {
  const today        = todayStr();
  const [period,     setPeriod]  = useState<'month' | 'quarter'>('month');
  const [from,       setFrom]    = useState(monthStartStr());
  const [to,         setTo]      = useState(today);
  const [loading,    setLoading] = useState(false);
  const [show3b,     setShow3b]  = useState(false);
  const { requirePin, config: lockConfig } = useAdminLock();
  const toast    = useToast();
  const settings = useSettings();
  const gstin    = (settings as any).gstin as string;

  const dateError = validateRange(from, to);

  const setPeriodMonth = () => {
    setPeriod('month');
    setFrom(monthStartStr());
    setTo(today);
  };

  const setPeriodQuarter = () => {
    setPeriod('quarter');
    setFrom(quarterStartStr());
    setTo(today);
  };

  const doDownloadGstr1 = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const filename = `GSTR1_${from}_to_${to}.json`;
      await downloadFile(`${API_ORIGIN}/api/export/gst/gstr1?${params}`, filename);
      toast(`GSTR-1 JSON downloaded — upload at gst.gov.in`, 'success');
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadGstr1 = () => {
    if (dateError) { toast(dateError, 'error'); return; }
    if (!lockConfig.enabled) { doDownloadGstr1(); return; }
    requirePin(doDownloadGstr1, 'Download GSTR-1', 'Enter admin PIN to export GST filing');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <h4 className="font-semibold text-white text-sm">GST Filing</h4>
        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">GSTR-1 + GSTR-3B</span>
      </div>
      <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
        GSTR-1 JSON is ready to upload directly on <span className="text-zinc-300">gst.gov.in → File Returns → GSTR-1 → Upload JSON.</span>
        GSTR-3B summary gives you the exact numbers to enter manually — click any value to copy it.
      </p>

      {!gstin && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
          <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-amber-400 text-xs leading-relaxed">
            GSTIN not set — go to <span className="font-semibold">Admin → Restaurant → GST Settings</span> to add your GSTIN before filing.
          </p>
        </div>
      )}

      {/* Period selector */}
      <div className="mb-4">
        <label className="label mb-2">Filing Period</label>
        <div className="flex gap-2 mb-3">
          <button
            onClick={setPeriodMonth}
            className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
              period === 'month'
                ? 'bg-brand-500 border-brand-600 text-white'
                : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            This Month
          </button>
          <button
            onClick={setPeriodQuarter}
            className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
              period === 'quarter'
                ? 'bg-brand-500 border-brand-600 text-white'
                : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            This Quarter
          </button>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">From</label>
            <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60' : ''}`}
              value={from} max={today} onChange={e => { setFrom(e.target.value); setPeriod('month'); }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60' : ''}`}
              value={to} max={today} onChange={e => { setTo(e.target.value); setPeriod('month'); }} />
          </div>
        </div>
        <DateRangeError message={dateError} />
      </div>

      {/* GSTR-1 download */}
      <div className="rounded-lg bg-surface-raised border border-surface-border p-4 mb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-white text-xs font-semibold">GSTR-1 JSON</p>
            <p className="text-zinc-500 text-[10px] mt-0.5 leading-relaxed">
              Portal-uploadable JSON. Includes B2CS aggregate (all walk-in sales) and B2B invoices (customers with GSTIN).
            </p>
          </div>
          <div className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
            Upload to portal
          </div>
        </div>
        <button
          className="btn btn-brand btn-sm flex items-center gap-2"
          onClick={handleDownloadGstr1}
          disabled={loading || !!dateError}
        >
          {loading
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Download GSTR-1 JSON</>
          }
        </button>
        {lockConfig.enabled && <PinLockNote />}

        <div className="mt-3 pt-3 border-t border-surface-border grid grid-cols-2 gap-2">
          {[
            'B2CS aggregate (walk-in)',
            'B2B line items (GSTIN)',
            'HSN/SAC summary',
            'Document issue details',
            'CGST + SGST split',
            'Ready to upload on portal',
          ].map(f => (
            <div key={f} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* GSTR-3B summary toggle */}
      <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setShow3b(v => !v)}
        >
          <div>
            <p className="text-white text-xs font-semibold">GSTR-3B Summary</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">Click to expand — shows exact values to enter on the GST portal</p>
          </div>
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ml-3 ${show3b ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {show3b && <Gstr3bSummary from={from} to={to} />}
      </div>
    </div>
  );
}

// ── Main Export Tab ────────────────────────────────────────────────────────

export default function ExportTab() {
  return (
    <div className="space-y-5">
      <OurFormatSection />
      <GstFilingSection />
    </div>
  );
}