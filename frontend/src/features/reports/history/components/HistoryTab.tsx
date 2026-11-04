import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { REPORT_HISTORY_LIMIT } from 'config/constants';
import { useSettings } from 'state/settings/useSettings';
import { useHistory } from '../hooks/useHistory';
import VisitRow from '../visit/VisitRow';
import HistoryFilters from './HistoryFilters';
import ResultsBar from './ResultsBar';

export default function HistoryTab() {
  const sym = useSettings().currency_symbol || '₹';
  const h = useHistory();
  const { from, to } = h.appliedRange;
  const searching = h.search.trim().length > 0;

  return (
    <div>
      <HistoryFilters from={h.draft.from} to={h.draft.to} error={h.rangeError} loading={h.loading}
        onFrom={v => h.setDraft(d => ({ ...d, from: v }))} onTo={v => h.setDraft(d => ({ ...d, to: v }))} onSearch={h.apply} onToday={h.today} />
      <ErrorNotice error={h.error} onRetry={h.reload} fallback="Could not load the history" />
      {h.truncated && (
        <div role="status" className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs">
          This range has more than {REPORT_HISTORY_LIMIT} orders. Only the newest {REPORT_HISTORY_LIMIT} are shown, so the oldest visit may be incomplete — choose a shorter range.
        </div>
      )}
      <ResultsBar search={h.search} onSearch={h.setSearch} count={h.shown.length} of={h.visits.length} total={h.total} sym={sym} rangeLabel={from === to ? from : `${from} – ${to}`} />

      {!h.loaded && h.loading ? <PageSpinner /> : h.shown.length === 0 ? (
        h.loaded && <EmptyState title={searching ? 'No matching visits' : 'No orders found'} hint={searching ? 'Try a different name, phone, GSTIN, item, or amount' : 'No orders in this date range'} />
      ) : (
        <div className={`space-y-2 ${h.loading ? 'opacity-60' : ''}`} aria-busy={h.loading}>
          <p className="px-1 mb-3 text-zinc-600 text-xs">Tap any visit to expand. Expand to edit payment or print the bill.</p>
          {h.shown.map(v => <VisitRow key={v.key} visit={v} sym={sym} onChanged={h.reload} />)}
        </div>
      )}
    </div>
  );
}
