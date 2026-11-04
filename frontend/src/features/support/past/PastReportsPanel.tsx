import { useCallback, useState } from 'react';
import { listBugReports } from 'api/office/support.api';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import { useAsync } from 'hooks/async/useAsync';
import { formatDate } from 'lib/format/local-time';

const SEV: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#6b7280' };
const STATUS: Record<string, string> = { open: 'text-red-400 bg-red-500/10', in_progress: 'text-amber-400 bg-amber-500/10', resolved: 'text-emerald-400 bg-emerald-500/10', closed: 'text-zinc-400 bg-zinc-700/40' };

/** Admin-only: every ticket this restaurant sent, with what the operator has done with it. */
export default function PastReportsPanel() {
  const load = useCallback((s: AbortSignal) => listBugReports(s), []);
  const { data, error, loading, reload } = useAsync(load);
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div><p className="text-white text-sm font-semibold">Past Tickets</p><p className="text-zinc-500 text-[11px] mt-0.5">Visible to admins only — every ticket sent from this restaurant.</p></div>
        <button type="button" onClick={reload} disabled={loading} className="btn btn-sm flex-shrink-0">Refresh</button>
      </div>
      <ErrorNotice error={error} onRetry={reload} fallback="Could not load past tickets." />
      {data === null ? (loading && <p className="text-zinc-600 text-xs py-2">Loading…</p>) : data.length === 0 ? <p className="text-zinc-600 text-xs py-2">No tickets sent yet.</p> : (
        <ul className="space-y-1.5">
          {data.map(r => (
            <li key={r.id} className="rounded-lg border border-surface-border bg-surface-raised overflow-hidden">
              <button type="button" aria-expanded={openId === r.id} onClick={() => setOpenId(o => (o === r.id ? null : r.id))} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: SEV[r.severity] ?? SEV.low, background: `${SEV[r.severity] ?? SEV.low}22` }}>{r.severity}</span>
                <span className="flex-1 min-w-0 text-white text-xs font-medium truncate">{r.title}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS[r.status] ?? STATUS.closed}`}>{r.status.replace('_', ' ')}</span>
                <span className="text-zinc-600 text-[10px] flex-shrink-0">{formatDate(r.created_at, { day: 'numeric', month: 'short' })}</span>
              </button>
              {openId === r.id && (
                <div className="px-3 pb-3 border-t border-surface-border">
                  <p className="text-zinc-300 text-xs leading-relaxed mt-2 whitespace-pre-wrap">{r.description}</p>
                  {r.steps.length > 0 && <div className="mt-2"><p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mb-1">Steps</p><ol className="list-decimal list-inside text-zinc-400 text-xs space-y-0.5">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
                  <p className="text-zinc-700 text-[10px] mt-2">Category: {r.category}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
