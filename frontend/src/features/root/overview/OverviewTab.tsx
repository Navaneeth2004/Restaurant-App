import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { daysLeft, timeAgo } from 'lib/format/local-time';
import Badge, { severityTone, ticketTone } from '../ui/Badge';
import Stat from '../ui/Stat';
import { useOverview } from './useOverview';

const CARD = 'rounded-xl border border-surface-border bg-surface-card p-4';
const HEAD = 'text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3';

export default function OverviewTab({ onOpen, onTickets }: { onOpen: (id: string) => void; onTickets: () => void }) {
  const { data: d, error, reload } = useOverview();
  if (!d) return error ? <ErrorNotice error={error} onRetry={reload} fallback="Could not load the overview" /> : <PageSpinner />;
  const by = d.restaurants.by_status;
  const up = d.server.uptime_s;

  return (
    <div className="space-y-5">
      <ErrorNotice error={error} onRetry={reload} fallback="Could not refresh the overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Restaurants" value={d.restaurants.total} sub={`${by.active ?? 0} active · ${by.suspended ?? 0} suspended`} />
        <Stat label="Linked devices" value={d.devices} sub={`${d.connected_sockets ?? '—'} connected now`} />
        <Stat label="Open tickets" value={d.tickets.open} sub={d.tickets.critical_open ? `${d.tickets.critical_open} critical` : 'none critical'} tone={d.tickets.critical_open ? 'red' : undefined} />
        <Stat label="Owner accounts" value={d.owners} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3"><p className={`${HEAD} mb-0`}>Latest tickets</p><button type="button" onClick={onTickets} className="text-xs text-brand-400 hover:underline">View all</button></div>
          {d.recent_tickets.length === 0 && <p className="text-zinc-600 text-xs">No tickets yet.</p>}
          <ul className="space-y-2">
            {d.recent_tickets.map(t => (
              <li key={t.id} className="flex items-center gap-2 text-xs">
                <Badge tone={severityTone(t.severity)}>{t.severity}</Badge><span className="text-zinc-200 truncate flex-1">{t.title}</span>
                <span className="text-zinc-500 truncate max-w-[110px]">{t.restaurant_name}</span><Badge tone={ticketTone(t.status)}>{t.status.replace('_', ' ')}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className={CARD}>
          <p className={HEAD}>Recently active</p>
          <ul className="space-y-2">{d.recently_active.map(r => <li key={r.id}><button type="button" onClick={() => onOpen(r.id)} className="w-full flex items-center justify-between text-xs hover:bg-surface-raised rounded-lg px-2 py-1.5 text-left"><span className="text-zinc-200 truncate">{r.name}</span><span className="text-zinc-500">{timeAgo(r.last_seen)}</span></button></li>)}</ul>
        </div>
        {d.trial_ending_soon.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className={`${HEAD} text-amber-400`}>Trials ending within 7 days</p>
            <ul className="space-y-2">{d.trial_ending_soon.map(r => { const left = daysLeft(r.trial_ends_at) ?? 0; return (
              <li key={r.id}><button type="button" onClick={() => onOpen(r.id)} className="w-full flex items-center justify-between text-xs hover:bg-surface-raised rounded-lg px-2 py-1.5 text-left"><span className="text-zinc-200">{r.name}</span><span className="text-amber-400">{left <= 0 ? 'ended' : `${left}d left`}</span></button></li>); })}</ul>
          </div>
        )}
        <div className={CARD}>
          <p className={HEAD}>Server</p>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs font-mono">
            <dt className="text-zinc-500 font-sans">Node</dt><dd className="text-zinc-200 text-right">{d.server.node}</dd>
            <dt className="text-zinc-500 font-sans">Uptime</dt><dd className="text-zinc-200 text-right">{Math.floor(up / 3600)}h {Math.floor((up % 3600) / 60)}m</dd>
            <dt className="text-zinc-500 font-sans">Memory</dt><dd className="text-zinc-200 text-right">{d.server.memory_mb} MB</dd>
            <dt className="text-zinc-500 font-sans">Mode</dt><dd className="text-zinc-200 text-right">{d.server.deployment}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
