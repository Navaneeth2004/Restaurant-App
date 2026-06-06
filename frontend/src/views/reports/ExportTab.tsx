/**
 * frontend/src/views/reports/ExportTab.tsx
 *
 * Unified export panel — replaces VyaparExport.tsx.
 * Covers:
 *   - "Our Format" (date range → CSV or JSON, moved from History tab)
 *   - "Vyapar Format" (single day or date range → Vyapar-compatible CSV)
 */

import React, { useState } from 'react';

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

// ── Shared status display ─────────────────────────────────────────────────
function Status({ ok, msg }: { ok: boolean | null; msg: string }) {
  if (ok === null) return null;
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

// ── Section: Our Format ───────────────────────────────────────────────────
function OurFormatSection() {
  const today = new Date().toISOString().split('T')[0];
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [loading, setLoading] = useState<'csv' | 'json' | null>(null);
  const [status,  setStatus]  = useState<{ ok: boolean; msg: string } | null>(null);

  const label = () => {
    if (from && to)   return `${from}_to_${to}`;
    if (from)         return `from_${from}`;
    if (to)           return `to_${to}`;
    return 'all';
  };

  const run = async (fmt: 'csv' | 'json') => {
    setLoading(fmt);
    setStatus(null);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const ext      = fmt === 'csv' ? 'csv' : 'json';
      const filename = `sales_${label()}.${ext}`;
      await downloadFile(`${API_ORIGIN}/api/export/revenue?${params}`, filename);
      setStatus({ ok: true, msg: `Downloaded ${filename}` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message || 'Export failed' });
    } finally {
      setLoading(null);
    }
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

      {/* What's included */}
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

// ── Section: Vyapar Format ────────────────────────────────────────────────
function VyaparSection() {
  const today = new Date().toISOString().split('T')[0];
  const [from,    setFrom]    = useState(today);
  const [to,      setTo]      = useState(today);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState<{ ok: boolean; msg: string } | null>(null);

  const run = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const params   = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const label    = from === to ? from : `${from}_to_${to}`;
      const filename = `sales_vyapar_${label}.csv`;
      await downloadFile(`${API_ORIGIN}/api/export/vyapar?${params}`, filename);
      setStatus({ ok: true, msg: `Downloaded ${filename}` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message || 'Export failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h4 className="font-semibold text-white text-sm mb-1">Vyapar Format</h4>
      <p className="text-zinc-500 text-xs mb-4">
        CSV formatted for Vyapar's sale invoice import. Each table order becomes one invoice, each item a line.
        Import via <span className="text-zinc-300">Sale → Sale Invoices → (xls icon top-right)</span>.
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
      </div>

      <button className="btn btn-brand mt-4 flex items-center gap-2"
        onClick={run} disabled={loading}>
        {loading
          ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
          : <><DownloadIcon />Download Vyapar CSV</>
        }
      </button>

      {status && <Status ok={status.ok} msg={status.msg} />}

      {/* Column preview table */}
      <div className="mt-4 pt-4 border-t border-surface-border">
        <p className="text-zinc-600 text-[10px] mb-2 uppercase tracking-wider font-semibold">CSV columns</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-surface-border">
                {['Invoice No','Date','Party','Item','Qty','Rate','Tax %','Total'].map(h => (
                  <th key={h} className="text-left text-zinc-600 font-semibold pb-1.5 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['20250606-001','06/06/2025','Table T3','Crispy Wings','2','8.99','5.0','18.88'],
                ['','','','Lemonade','1','2.99','5.0','3.14'],
                ['20250606-002','06/06/2025','Table T1','Burger','1','11.99','5.0','12.59'],
              ].map((row, i) => (
                <tr key={i} className="border-b border-surface-border/30">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap">
                      {cell || <span className="text-zinc-700">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-zinc-700 text-[10px] mt-2">
          Invoice No only on first row per invoice. Party Name = table label. Tax rate matches your Admin → Restaurant settings.
        </p>
      </div>
    </div>
  );
}

// ── Icon helper ───────────────────────────────────────────────────────────
function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

// ── Main export tab ───────────────────────────────────────────────────────
export default function ExportTab() {
  return (
    <div className="space-y-5">
      <OurFormatSection />
      <VyaparSection />
    </div>
  );
}