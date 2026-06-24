/**
 * views/reports/HistoryTab.tsx
 *
 * Date-filtered order history list with session grouping.
 *
 * NEW: Search box — filters the currently-loaded sessions (within the
 * selected date range) by customer name, phone, GSTIN, item name, table
 * id/label, payment method, or amount (bill total / amount paid).
 * This is a client-side filter over `sessions`, so it's instant and
 * doesn't need a new backend endpoint. Searching across a *different*
 * date range still requires picking new From/To dates first.
 *
 * REDESIGN NOTES (unchanged from before):
 * - Filter row: date inputs, Search and Today are now all h-10, so nothing
 *   looks "almost aligned." Search button got a fixed min-width so it
 *   doesn't visually dominate next to the small "Today" pill.
 * - Replaced the bare "10 visits  ₹573.43" text line with a small stat
 *   strip that matches the rest of the app's pill/card language.
 * - Mobile: filters wrap onto their own rows below ~480px instead of
 *   squeezing four controls into one line.
 * - "Today" button no longer gets an orange active-state outline when
 *   the range happens to equal today (which is the default, so it was lit
 *   almost all the time and looked like a stray border around plain text).
 *   It's now a plain neutral button, matching the "Today" button style in
 *   the Export tab.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import SessionRow from './SessionRow';
import { groupOrdersIntoSessions } from '../../utils/sessions';
import { getReportHistory } from '../../services/api';
import type { Order } from '../../types';
import type { TableSession } from '../../utils/sessions';

interface Props {
  sym:    string;
  taxPct: number;
  brand:  string;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalises a string for loose matching: lowercase, strip non-alphanumerics. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9.]/g, '');
}

/**
 * Returns true if `session` matches the given search query.
 * Matches against: customer name, phone, GSTIN, item names, table id/label,
 * payment method (incl. split sub-methods), and numeric amounts (bill total
 * or amount paid, with or without decimals).
 */
function sessionMatchesQuery(session: TableSession, query: string, taxPct: number): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const qNorm = norm(query);

  // Text fields
  const textHaystack = [
    session.tableId,
    session.customerName || '',
    session.customerPhone || '',
    (session as any).customerGstin || '',
    session.paymentMethod || '',
    ...session.allItems.map(i => i.name),
  ].join(' ').toLowerCase();

  if (textHaystack.includes(q)) return true;

  // Phone/GSTIN often searched without spaces/punctuation — try normalised match too
  const phoneNorm  = norm(session.customerPhone || '');
  const gstinNorm  = norm((session as any).customerGstin || '');
  if (qNorm && (phoneNorm.includes(qNorm) || gstinNorm.includes(qNorm))) return true;

  // Split payment sub-methods
  if (session.paymentMethod === 'split' && session.paymentDetails) {
    try {
      const arr = Array.isArray(session.paymentDetails)
        ? session.paymentDetails
        : typeof session.paymentDetails === 'string'
          ? JSON.parse(session.paymentDetails)
          : [];
      if (Array.isArray(arr) && arr.some((e: any) => String(e.method || '').toLowerCase().includes(q))) {
        return true;
      }
    } catch {}
  }

  // Numeric / amount match — only attempt if the query looks like a number
  const qAmount = parseFloat(query.replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(qAmount) && /[0-9]/.test(query)) {
    const billTotal = session.totalAmount * (1 + taxPct);
    const paidTotal = session.amountPaid != null ? session.amountPaid : billTotal;
    const candidates = [billTotal, paidTotal, session.totalAmount];
    // Match if any candidate amount, rounded to 2dp, equals or starts with the typed number
    if (candidates.some(c => {
      const fixed = c.toFixed(2);
      return fixed === qAmount.toFixed(2) || fixed.startsWith(query.trim()) || Math.abs(c - qAmount) < 0.005;
    })) {
      return true;
    }
  }

  return false;
}

export default function HistoryTab({ sym, taxPct, brand }: Props) {
  const [history,  setHistory]  = useState<Order[]>([]);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo,   setDateTo]   = useState(todayStr());
  const [loading,  setLoading]  = useState(false);
  const [dateError, setDateError] = useState('');
  const [search,   setSearch]   = useState('');

  const validateRange = (from: string, to: string): string => {
    if (from && to && from > to) {
      return `"From" date (${from}) is after "To" date (${to}). Please fix the range.`;
    }
    return '';
  };

  const loadHistory = useCallback(async (from: string, to: string) => {
    const err = validateRange(from, to);
    setDateError(err);
    if (err) return;

    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (from) p.from = from;
      if (to)   p.to   = to;
      setHistory(await getReportHistory(p));
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => loadHistory(dateFrom, dateTo);

  const handleFromChange = (v: string) => {
    setDateFrom(v);
    setDateError(validateRange(v, dateTo));
  };

  const handleToChange = (v: string) => {
    setDateTo(v);
    setDateError(validateRange(dateFrom, v));
  };

  const handleResetToday = () => {
    const t = todayStr();
    setDateFrom(t);
    setDateTo(t);
    setDateError('');
    loadHistory(t, t);
  };

  const allSessions = useMemo(() => groupOrdersIntoSessions(history), [history]);

  const sessions = useMemo(() => {
    if (!search.trim()) return allSessions;
    return allSessions.filter(s => sessionMatchesQuery(s, search, taxPct));
  }, [allSessions, search, taxPct]);

  const histTotal = sessions.reduce((s, sess) => s + sess.totalAmount * (1 + taxPct), 0);

  return (
    <div>
    {/* ── Date range + search action ──────────────────────────────── */}
    <div className="mb-4">
    <div className="flex items-end gap-2.5 flex-wrap">
        <div className="flex-1 min-w-[140px] sm:flex-none sm:w-44">
        <label className="label">From</label>
        <input
            type="date"
            className={`input h-10 w-full ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
            value={dateFrom}
            onChange={e => handleFromChange(e.target.value)}
        />
        </div>
        <div className="flex-1 min-w-[140px] sm:flex-none sm:w-44">
        <label className="label">To</label>
        <input
            type="date"
            className={`input h-10 w-full ${dateError ? 'border-red-500/60 focus:border-red-500' : ''}`}
            value={dateTo}
            onChange={e => handleToChange(e.target.value)}
        />
        </div>

        {/* Search + Today — identical height (h-10). Today is now a plain
            neutral button (no conditional orange highlight), matching the
            Today button in the Export tab. */}
        <div className="flex items-stretch gap-2 flex-1 sm:flex-none">
        <button
            className="btn btn-brand h-10 px-5 min-w-[104px] flex-1 sm:flex-none justify-center"
            onClick={handleSearch}
            disabled={loading || !!dateError}
        >
            {loading ? 'Loading…' : 'Search'}
        </button>
        <button
            className="btn h-10 px-4 min-w-[88px] justify-center flex-1 sm:flex-none"
            onClick={handleResetToday}
        >
            Today
        </button>
        </div>
    </div>

    {dateError && (
        <div className="flex items-start gap-2 px-3 py-2 mt-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {dateError}
        </div>
    )}
    </div>

    {/* ── Results: search-within-results + count, grouped together ─── */}
    <div className="mb-4 p-3 rounded-xl bg-surface-card/60 border border-surface-border space-y-2.5">
    <div className="relative">
        <svg
        className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
        type="text"
        className="input h-10 w-full pl-9 pr-9 bg-surface-raised"
        placeholder="Search by name, phone, GSTIN, item, or amount…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        />
        {search && (
        <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-card transition-colors"
            title="Clear search"
        >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
        )}
    </div>

    <div className="flex items-center justify-between gap-2 flex-wrap">
        {sessions.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-surface-raised border border-surface-border px-2.5 py-1 rounded-full">
            <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            {sessions.length} visit{sessions.length !== 1 ? 's' : ''}
            {search.trim() && allSessions.length !== sessions.length && (
                <span className="text-zinc-600"> of {allSessions.length}</span>
            )}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-500/25 px-2.5 py-1 rounded-full font-mono">
            {sym}{histTotal.toFixed(2)}
            </span>
        </div>
        ) : <span />}

        {search.trim() && (
        <p className="text-zinc-600 text-[10px] leading-snug">
            Within {dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`} — change dates above to widen
        </p>
        )}
    </div>
    </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <p className="text-sm font-medium">
            {search.trim() ? 'No matching visits' : 'No orders found'}
          </p>
          <p className="text-xs mt-1">
            {dateError
              ? 'Fix the date range above'
              : search.trim()
                ? 'Try a different name, phone, GSTIN, item, or amount'
                : 'No orders in this date range'}
          </p>
          {search.trim() && (
            <button
              onClick={() => setSearch('')}
              className="mt-3 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-1 mb-3">
            <p className="text-zinc-600 text-xs">Tap any visit to expand. Expand to edit payment or print bill.</p>
          </div>
          {sessions.map(session => (
            <SessionRow
              key={session.sessionKey}
              session={session}
              sym={sym}
              taxPct={taxPct}
              brand={brand}
            />
          ))}
        </div>
      )}
    </div>
  );
}