/**
 * views/ExportView.tsx
 *
 * Standalone Export tab (admin-only) with a pill switcher between:
 *   - Detailed Report (CSV / JSON)
 *   - GSTR-1 (portal-upload JSON)
 *   - GSTR-3B (on-screen summary with copy fields)
 *
 * Content is lifted directly from the old ExportTab sections.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminLock } from '../context/AdminLockContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { authedJson } from '../utils/authedFetch';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;

type Section = 'detailed' | 'gstr1' | 'gstr3b';

// ── Shared helpers ─────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function monthStartStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function quarterStartStr(): string {
  const d = new Date();
  const m = d.getMonth();
  const qm = Math.floor(m / 3) * 3;
  return `${d.getFullYear()}-${String(qm+1).padStart(2,'0')}-01`;
}

function validateRange(from: string, to: string): string {
  if (from && to && from > to) return `"From" (${from}) is after "To" (${to}).`;
  return '';
}

async function getToken(): Promise<string | null> {
  try {
    const res  = await fetch(`${API_ORIGIN}/api/auth/token`);
    const data = await res.json();
    return data.token ?? null;
  } catch { return null; }
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const token = await getToken();
  const res   = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
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

// ── Detailed Report section ────────────────────────────────────────────────

function DetailedSection() {
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
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-white text-sm mb-1">Detailed Revenue Report</h3>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Full breakdown — daily totals, top items, tax, payment methods, and every order. Export as CSV for spreadsheets or JSON for integrations.
        </p>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-semibold text-white text-xs uppercase tracking-widest mb-4 text-zinc-500">Date Range</h4>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">From</label>
            <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
              value={from} max={today} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className={`input w-44 ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
              value={to} max={today} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-sm text-xs mb-0.5" onClick={() => { setFrom(today); setTo(today); }}>Today</button>
        </div>
        <DateRangeError message={dateError} />

        <div className="flex gap-3 mt-5 flex-wrap">
          <button className="btn btn-brand flex items-center gap-2"
            onClick={() => run('csv')} disabled={loading !== null || !!dateError}>
            {loading === 'csv'
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
              : <><DownloadIcon />Export CSV</>}
          </button>
          <button className="btn flex items-center gap-2 text-xs"
            onClick={() => run('json')} disabled={loading !== null || !!dateError}>
            {loading === 'json'
              ? <><span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />Generating…</>
              : <><DownloadIcon />Export JSON</>}
          </button>
        </div>
        {lockConfig.enabled && <PinLockNote />}
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <p className="text-zinc-500 text-xs font-semibold mb-3 uppercase tracking-widest">What's included</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['Summary block','Tax collected','Avg order value','Items sold',
            'Revenue excl. tax','Daily breakdown','Top items ranking','Full order detail',
            'Payment methods','Order type split','Change amounts','Session IDs'].map(f => (
            <div key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GSTR-1 section ─────────────────────────────────────────────────────────

function Gstr1Section() {
  const today   = todayStr();
  const [period, setPeriod] = useState<'month' | 'quarter'>('month');
  const [from,   setFrom]   = useState(monthStartStr());
  const [to,     setTo]     = useState(today);
  const [loading, setLoading] = useState(false);
  const { requirePin, config: lockConfig } = useAdminLock();
  const toast    = useToast();
  const settings = useSettings();
  const gstin    = (settings as any).gstin as string;

  const dateError = validateRange(from, to);

  const doDownload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      await downloadFile(`${API_ORIGIN}/api/export/gst/gstr1?${params}`, `GSTR1_${from}_to_${to}.json`);
      toast('GSTR-1 JSON downloaded — upload at gst.gov.in', 'success');
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handle = () => {
    if (dateError) { toast(dateError, 'error'); return; }
    if (!lockConfig.enabled) { doDownload(); return; }
    requirePin(doDownload, 'Download GSTR-1', 'Enter admin PIN to export GST filing');
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-white text-sm">GSTR-1 Export</h3>
          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">Upload to portal</span>
        </div>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Portal-uploadable JSON. Includes B2CS aggregate (all walk-in sales) and B2B invoices (customers with GSTIN).
          Upload at <span className="text-zinc-300">gst.gov.in → File Returns → GSTR-1 → Upload JSON.</span>
        </p>
      </div>

      {!gstin && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
          <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-amber-400 text-xs leading-relaxed">
            GSTIN not set — go to <span className="font-semibold">Admin → Restaurant → GST Settings</span> to add your GSTIN before filing.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest mb-4">Filing Period</h4>
        <div className="flex gap-2 mb-4">
          {([
            { key: 'month',   label: 'This Month',    fn: () => { setPeriod('month');   setFrom(monthStartStr());   setTo(today); } },
            { key: 'quarter', label: 'This Quarter',  fn: () => { setPeriod('quarter'); setFrom(quarterStartStr()); setTo(today); } },
          ] as const).map(p => (
            <button key={p.key} onClick={p.fn}
              className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
                period === p.key ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-end gap-3 flex-wrap mb-4">
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

        <button className="btn btn-brand flex items-center gap-2 mt-4"
          onClick={handle} disabled={loading || !!dateError}>
          {loading
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            : <><DownloadIcon />Download GSTR-1 JSON</>}
        </button>
        {lockConfig.enabled && <PinLockNote />}
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <p className="text-zinc-500 text-xs font-semibold mb-3 uppercase tracking-widest">What's included</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['B2CS aggregate (walk-in)','B2B line items (GSTIN)','HSN/SAC summary',
            'Document issue details','CGST + SGST split','Ready to upload on portal'].map(f => (
            <div key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GSTR-3B section ────────────────────────────────────────────────────────

function Gstr3bSection() {
  const today   = todayStr();
  const [period, setPeriod] = useState<'month' | 'quarter'>('month');
  const [from,   setFrom]   = useState(monthStartStr());
  const [to,     setTo]     = useState(today);
  const [data,   setData]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const toast    = useToast();

  const dateError = validateRange(from, to);

  const load = useCallback(async () => {
    if (dateError) return;
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
  }, [from, to, dateError]);

  useEffect(() => { load(); }, [load]);

  const copyField = (label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => toast(`Copied: ${label}`, 'success'));
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-white text-sm">GSTR-3B Summary</h3>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Manual filing guide</span>
        </div>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Shows exact values to enter on the GST portal under GSTR-3B. Click any value to copy it directly.
        </p>
      </div>

      {/* Period selector */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest mb-4">Filing Period</h4>
        <div className="flex gap-2 mb-4">
          {([
            { key: 'month',   label: 'This Month',   fn: () => { setPeriod('month');   setFrom(monthStartStr());   setTo(today); } },
            { key: 'quarter', label: 'This Quarter', fn: () => { setPeriod('quarter'); setFrom(quarterStartStr()); setTo(today); } },
          ] as const).map(p => (
            <button key={p.key} onClick={p.fn}
              className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
                period === p.key ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}>{p.label}</button>
          ))}
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
          <button className="btn btn-sm mb-0.5" onClick={load} disabled={loading || !!dateError}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <DateRangeError message={dateError} />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {loading && !data && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs py-4">
          <span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          Loading GSTR-3B summary…
        </div>
      )}

      {data && (() => {
        const o = data.outward_taxable;
        return (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: 'GSTIN',      v: data.gstin      || '—' },
                { l: 'Legal Name', v: data.legal_name  || '—' },
                { l: 'Tax Rate',   v: `${data.tax_rate}%` },
                { l: 'Orders',     v: String(data.order_count) },
              ].map(({ l, v }) => (
                <div key={l} className="rounded-xl border border-surface-border bg-surface-card px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{l}</p>
                  <p className="text-white text-xs font-mono font-semibold">{v}</p>
                </div>
              ))}
            </div>

            {/* Table 3.1 */}
            <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="bg-surface-raised px-4 py-3 border-b border-surface-border">
                <p className="text-zinc-300 text-xs font-semibold">Table 3.1 — Outward Taxable Supplies</p>
                <p className="text-zinc-600 text-[10px] mt-0.5">Enter under GSTR-3B → 3.1(a) on the GST portal. Click a value to copy.</p>
              </div>
              <div className="divide-y divide-surface-border">
                {[
                  { label: 'Total Taxable Value (pre-tax)', value: o.total_taxable_value },
                  { label: 'Integrated Tax (IGST)',         value: o.integrated_tax },
                  { label: 'Central Tax (CGST)',            value: o.central_tax },
                  { label: 'State/UT Tax (SGST)',           value: o.state_ut_tax },
                  { label: 'Cess',                          value: 0 },
                ].map(({ label, value }) => (
                  <button key={label}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors text-left group"
                    onClick={() => copyField(label, value.toFixed(2))}>
                    <span className="text-zinc-400 text-sm">{label}</span>
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
            <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="bg-surface-raised px-4 py-3 border-b border-surface-border">
                <p className="text-zinc-300 text-xs font-semibold">Table 4 — Eligible ITC</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-zinc-500 text-xs leading-relaxed">{data.itc_claimed.note}</p>
                <p className="text-zinc-600 text-[10px] mt-1.5">Enter ₹0 for all ITC fields in Table 4 on the portal.</p>
              </div>
            </div>

            {/* Table 6.1 — Tax paid */}
            <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="bg-surface-raised px-4 py-3 border-b border-surface-border">
                <p className="text-zinc-300 text-xs font-semibold">Table 6.1 — Tax Paid</p>
                <p className="text-zinc-600 text-[10px] mt-0.5">Same as 3.1 amounts — enter under "Tax paid through cash/ITC" on the portal.</p>
              </div>
              <div className="divide-y divide-surface-border">
                {[
                  { label: 'Integrated Tax (IGST)', value: data.tax_paid.integrated_tax },
                  { label: 'Central Tax (CGST)',    value: data.tax_paid.central_tax },
                  { label: 'State/UT Tax (SGST)',   value: data.tax_paid.state_ut_tax },
                ].map(({ label, value }) => (
                  <button key={label}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors text-left group"
                    onClick={() => copyField(label, value.toFixed(2))}>
                    <span className="text-zinc-400 text-sm">{label}</span>
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

            <div className="rounded-xl bg-brand-500/8 border border-brand-500/20 px-4 py-3">
              <p className="text-brand-400 text-xs font-semibold mb-1">How to use this</p>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Log into <span className="text-zinc-300">gst.gov.in</span> → File Returns → GSTR-3B → enter the values above in the corresponding tables.
                For GSTR-1, switch to the GSTR-1 tab and download the JSON to upload directly.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main ExportView ────────────────────────────────────────────────────────

export default function ExportView() {
  const [section, setSection] = useState<Section>('detailed');

  const tabs: { key: Section; label: string; badge?: string }[] = [
    { key: 'detailed', label: 'Detailed Report' },
    { key: 'gstr1',    label: 'GSTR-1',    badge: 'JSON' },
    { key: 'gstr3b',   label: 'GSTR-3B',   badge: 'Guide' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <h2 className="font-bold text-white text-sm">Export</h2>
        <span className="text-zinc-500 text-xs hidden sm:block">
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        {/* Pill switcher */}
        <div className="ml-auto flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5">
          {tabs.map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                section === key ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
              {badge && (
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                  section === key ? 'bg-white/20 text-white' : 'bg-surface-border text-zinc-500'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {section === 'detailed' && <DetailedSection />}
        {section === 'gstr1'    && <Gstr1Section />}
        {section === 'gstr3b'   && <Gstr3bSection />}
      </div>
    </div>
  );
}