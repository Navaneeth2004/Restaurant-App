import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { formatMoney } from 'lib/format/money';
import { useSettings } from 'state/settings/useSettings';
import { useDeleted } from '../hooks/useDeleted';
import DeletedRow from './DeletedRow';

export default function DeletedTab() {
  const sym = useSettings().currency_symbol || '₹';
  const d = useDeleted();
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-bold text-white text-sm">Deleted Records</h3>
          <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed max-w-xl">Every visit deleted from History is logged here with what it contained, when it was deleted and by which admin. This list is read-only.</p>
        </div>
        <button type="button" onClick={d.reload} className="btn btn-sm flex-shrink-0" disabled={d.loading}>Refresh</button>
      </div>
      <ErrorNotice error={d.error} onRetry={d.reload} fallback="Could not load the deleted-records log" />
      {d.rows === null ? (d.loading && <PageSpinner />) : d.rows.length === 0 ? (
        <EmptyState title="Nothing has been deleted" hint="Deleted visits will appear here." />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-xs font-semibold text-zinc-300 bg-surface-raised border border-surface-border px-2.5 py-1 rounded-full">{d.rows.length} deleted</span>
            <span className="inline-flex items-center text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full font-mono">{formatMoney(d.totalRemoved, sym)} removed</span>
          </div>
          <div className="space-y-2">{d.rows.map(r => <DeletedRow key={r.id} record={r} sym={sym} />)}</div>
        </>
      )}
    </div>
  );
}
