import { useState } from 'react';
import PillTabs from 'components/layout/PillTabs';
import ChoicePills from 'components/ui/base/ChoicePills';
import RefreshButton from 'components/ui/base/RefreshButton';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { timeAgo } from 'lib/format/local-time';
import Badge, { severityTone, ticketTone } from '../../ui/Badge';
import { useTickets } from '../hooks/useTickets';
import TicketDetail from './TicketDetail';

interface Props { restaurantId: string; onClearRestaurant: () => void; onOpenRestaurant: (id: string) => void }

const STATUSES = [
  { key: 'active', label: 'Open + in progress' }, { key: 'open', label: 'Open' }, { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' }, { key: 'closed', label: 'Closed' }, { key: 'all', label: 'All' },
];
const SEVERITIES = [
  { value: '', label: 'Any' }, { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
];
const BAR: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#52525b' };

export default function TicketsTab({ restaurantId, onClearRestaurant, onOpenRestaurant }: Props) {
  const t = useTickets(restaurantId);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0"><PillTabs tabs={STATUSES} active={t.status} label="Ticket status" onSelect={t.setStatus} /></div>
        <RefreshButton onClick={t.reload} loading={t.loading} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input aria-label="Search tickets" className="input w-full sm:w-64" placeholder="Search title, text or restaurant…" value={t.search} onChange={e => t.setSearch(e.target.value)} />
        <ChoicePills label="Severity" options={SEVERITIES} value={t.severity} onChange={t.setSeverity} />
        {restaurantId && <button type="button" onClick={onClearRestaurant} className="text-xs text-brand-400 border border-brand-500/30 rounded-full px-2.5 py-1">Restaurant filter ✕</button>}
      </div>
      <ErrorNotice error={t.error} onRetry={t.reload} fallback="Could not load the tickets" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)] gap-4 items-start">
        <div className={`rounded-xl border border-surface-border bg-surface-card overflow-hidden ${selected !== null ? 'hidden lg:block' : ''}`}>
          {t.data === null ? (!t.error && <PageSpinner />) : t.data.length === 0 ? <p className="px-4 py-10 text-center text-zinc-600 text-xs">No tickets here.</p> : (
            <ul>{t.data.map(row => (
              <li key={row.id}>
                <button type="button" onClick={() => setSelected(row.id)} style={{ borderLeft: `4px solid ${BAR[row.severity] ?? BAR.low}` }}
                  className={`w-full text-left px-4 py-3 border-b border-surface-border/60 hover:bg-surface-raised/50 ${selected === row.id ? 'bg-brand-500/5' : ''}`}>
                  <p className="text-white text-sm font-semibold leading-snug break-words">{row.title}</p>
                  <p className="text-zinc-500 text-[11px] mt-0.5 break-words">{row.restaurant_name} · {row.submitted_by ?? 'unknown'} · {timeAgo(row.created_at)}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge tone={severityTone(row.severity)}>{row.severity}</Badge><Badge tone={ticketTone(row.status)}>{row.status.replace('_', ' ')}</Badge>
                    {row.has_screenshot ? <Badge>screenshot</Badge> : null}
                  </div>
                </button>
              </li>))}
            </ul>
          )}
        </div>
        <div className={selected === null ? 'hidden lg:block' : ''}>
          {selected !== null ? (
            <>
              <button type="button" className="btn btn-sm mb-2 lg:hidden" onClick={() => setSelected(null)}>← All tickets</button>
              <TicketDetail key={selected} id={selected} onChanged={t.reload} onOpenRestaurant={onOpenRestaurant} />
            </>
          ) : <div className="rounded-xl border border-dashed border-surface-border p-10 text-center text-zinc-600 text-xs">Select a ticket</div>}
        </div>
      </div>
    </div>
  );
}
