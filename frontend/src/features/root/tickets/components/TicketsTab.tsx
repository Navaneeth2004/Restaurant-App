import { useState } from 'react';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { timeAgo } from 'lib/format/local-time';
import Badge, { severityTone, ticketTone } from '../../ui/Badge';
import { useTickets } from '../hooks/useTickets';
import TicketDetail from './TicketDetail';

interface Props { restaurantId: string; onClearRestaurant: () => void; onOpenRestaurant: (id: string) => void }

export default function TicketsTab({ restaurantId, onClearRestaurant, onOpenRestaurant }: Props) {
  const t = useTickets(restaurantId);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select aria-label="Status" className="input w-auto" value={t.status} onChange={e => t.setStatus(e.target.value)}>
          <option value="active">Open + in progress</option><option value="all">All</option>
          {['open', 'in_progress', 'resolved', 'closed'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select aria-label="Severity" className="input w-auto" value={t.severity} onChange={e => t.setSeverity(e.target.value)}>
          <option value="">Any severity</option>{['critical', 'high', 'medium', 'low'].map(s => <option key={s}>{s}</option>)}
        </select>
        <input aria-label="Search tickets" className="input max-w-xs" placeholder="Search…" value={t.search} onChange={e => t.setSearch(e.target.value)} />
        {restaurantId && <button type="button" onClick={onClearRestaurant} className="text-xs text-brand-400 border border-brand-500/30 rounded-full px-2.5 py-1">Restaurant filter ✕</button>}
        <button type="button" className="btn btn-sm ml-auto" onClick={t.reload}>Refresh</button>
      </div>
      <ErrorNotice error={t.error} onRetry={t.reload} fallback="Could not load the tickets" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)] gap-4 items-start">
        <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          {t.data === null ? (!t.error && <PageSpinner />) : t.data.length === 0 ? <p className="px-4 py-10 text-center text-zinc-600 text-xs">No tickets here.</p> : (
            <ul>{t.data.map(row => (
              <li key={row.id}><button type="button" onClick={() => setSelected(row.id)} className={`w-full text-left px-4 py-3 border-b border-surface-border/60 hover:bg-surface-raised/50 ${selected === row.id ? 'bg-brand-500/5' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap"><Badge tone={severityTone(row.severity)}>{row.severity}</Badge><Badge tone={ticketTone(row.status)}>{row.status.replace('_', ' ')}</Badge>{row.has_screenshot ? <Badge>screenshot</Badge> : null}</div>
                <p className="text-white text-sm font-medium truncate">{row.title}</p>
                <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{row.restaurant_name} · {row.submitted_by ?? 'unknown'} · {timeAgo(row.created_at)}</p>
              </button></li>))}</ul>
          )}
        </div>
        {selected !== null ? <TicketDetail key={selected} id={selected} onChanged={t.reload} onOpenRestaurant={onOpenRestaurant} />
          : <div className="rounded-xl border border-dashed border-surface-border p-10 text-center text-zinc-600 text-xs">Select a ticket</div>}
      </div>
    </div>
  );
}
