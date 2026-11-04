import { ticketScreenshotUrl } from 'api/platform/root.api';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import Spinner from 'components/ui/feedback/Spinner';
import { formatDateTime, timeAgo } from 'lib/format/local-time';
import type { TicketStatus } from 'types/office/support';
import Badge, { severityTone, ticketTone } from '../../ui/Badge';
import { useTicket } from '../hooks/useTicket';
import TechnicalDetails from './TechnicalDetails';

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export default function TicketDetail({ id, onChanged, onOpenRestaurant }: { id: number; onChanged: () => void; onOpenRestaurant: (id: string) => void }) {
  const t = useTicket(id, onChanged);
  const d = t.data;
  if (!d) return t.error ? <ErrorNotice error={t.error} onRetry={t.reload} fallback="Could not load the ticket" /> : <PageSpinner />;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <Badge tone={severityTone(d.severity)}>{d.severity}</Badge>{d.category && <Badge>{d.category}</Badge>}<Badge tone={ticketTone(d.status)}>{d.status.replace('_', ' ')}</Badge>
          <span className="text-zinc-600 text-[11px]">#{d.id} · {formatDateTime(d.created_at)}</span>
        </div>
        <h3 className="text-white font-bold text-base">{d.title}</h3>
        <p className="text-zinc-500 text-xs mt-1">
          {d.restaurant ? <button type="button" className="text-brand-400 hover:underline" onClick={() => onOpenRestaurant(d.restaurant?.id ?? '')}>{d.restaurant.name}</button> : <span>{d.restaurant_name} (deleted)</span>}
          {' · '}{d.submitted_by ?? 'unknown'}{d.submitted_role ? ` (${d.submitted_role})` : ''}
        </p>
      </div>
      <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{d.description}</p>
      {d.steps.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Steps to reproduce</p><ol className="list-decimal list-inside text-zinc-300 text-xs space-y-0.5">{d.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
      {d.has_screenshot && <a href={ticketScreenshotUrl(d.id)} target="_blank" rel="noreferrer"><img src={ticketScreenshotUrl(d.id)} alt="Screenshot attached to the ticket" className="max-h-72 rounded-lg border border-surface-border" /></a>}
      <TechnicalDetails ticket={d} />
      <div className="border-t border-surface-border pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="label mb-0" htmlFor="tk-status">Status</label>
          <select id="tk-status" className="input w-auto" value={t.status} onChange={e => t.setStatus(STATUSES.find(s => s === e.target.value) ?? 'open')}>{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
          {d.resolved_at && <span className="text-zinc-600 text-[11px]">resolved {timeAgo(d.resolved_at)}</span>}
        </div>
        <div><label className="label" htmlFor="tk-note">Your note (private)</label><textarea id="tk-note" className="input resize-none" rows={3} value={t.note} onChange={e => t.setNote(e.target.value)} /></div>
        <button type="button" className="btn btn-brand btn-sm" onClick={() => void t.save()} disabled={t.busy}>{t.busy ? <><Spinner />Saving…</> : 'Save'}</button>
      </div>
    </div>
  );
}
