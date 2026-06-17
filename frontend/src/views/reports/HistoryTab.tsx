/**
 * views/reports/HistoryTab.tsx
 *
 * Date-filtered order history list with session grouping.
 * Extracted from ReportsView.tsx.
 */

import React, { useState, useCallback } from 'react';
import SessionRow from './SessionRow';
import { groupOrdersIntoSessions } from '../../utils/sessions';
import { getReportHistory } from '../../services/api';
import type { Order } from '../../types';

interface Props {
  sym:    string;
  taxPct: number;
  brand:  string;
}

export default function HistoryTab({ sym, taxPct, brand }: Props) {
  const [history,  setHistory]  = useState<Order[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [loading,  setLoading]  = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (dateFrom) p.from = dateFrom;
      if (dateTo)   p.to   = dateTo;
      setHistory(await getReportHistory(p));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const sessions  = groupOrdersIntoSessions(history);
  const histTotal = sessions.reduce((s, sess) => s + sess.totalAmount * (1 + taxPct), 0);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">From</label>
            <input type="date" className="input w-44" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input w-44" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <button className="btn btn-brand" onClick={loadHistory} disabled={loading}>
              {loading ? 'Loading…' : 'Search'}
            </button>
            {(dateFrom || dateTo) && (
              <button className="btn btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            )}
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-sm">{sessions.length} visits</span>
            <span className="font-mono font-bold text-white text-sm">{sym}{histTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <p className="text-sm font-medium">No orders found</p>
          <p className="text-xs mt-1">Click Search to load all history</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-1 mb-3">
            <p className="text-zinc-600 text-xs">Click any row to expand. Expand to edit payment or print bill.</p>
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