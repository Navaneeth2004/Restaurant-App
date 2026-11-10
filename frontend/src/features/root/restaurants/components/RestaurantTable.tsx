import { daysLeft, timeAgo } from 'lib/format/local-time';
import { formatBytes } from 'lib/format/format-bytes';
import type { RestaurantSummary } from 'types/office/root';
import Badge, { statusTone } from '../../ui/Badge';

/** `wide` columns are hidden on phones (their facts show under the name instead). */
const COLS: ReadonlyArray<{ label: string; wide?: boolean }> = [
  { label: 'Restaurant' }, { label: 'Owner', wide: true }, { label: 'Status' }, { label: 'Plan' }, { label: 'Trial', wide: true },
  { label: 'Devices', wide: true }, { label: 'Last seen', wide: true }, { label: 'Tickets' }, { label: 'DB', wide: true },
];
const WIDE = 'hidden md:table-cell';

function trial(r: RestaurantSummary): string | JSX.Element {
  if (r.plan !== 'trial' || !r.trial_ends_at) return '—';
  const left = daysLeft(r.trial_ends_at) ?? 0;
  return left <= 0 ? <span className="text-red-400">ended</span> : `${left}d left`;
}

export default function RestaurantTable({ rows, onOpen }: { rows: ReadonlyArray<RestaurantSummary>; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-surface-border text-left text-zinc-500">{COLS.map(c => <th key={c.label} scope="col" className={`px-3 md:px-4 py-2.5 font-bold uppercase tracking-widest text-[10px] whitespace-nowrap ${c.wide ? WIDE : ''}`}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-surface-border/50 hover:bg-surface-raised/50">
              <td className="px-3 md:px-4 py-3">
                <button type="button" onClick={() => onOpen(r.id)} className="text-left">
                  <span className="block text-white font-semibold text-sm">{r.name}</span>
                  <span className="block text-zinc-600 font-mono text-[10px]">{r.id}</span>
                  <span className="block md:hidden text-zinc-500 text-[11px] mt-0.5">{r.owner_phone} · {r.devices} devices · seen {timeAgo(r.last_seen_at)}</span>
                </button>
              </td>
              <td className={`px-4 py-3 text-zinc-300 font-mono ${WIDE}`}>{r.owner_phone}</td>
              <td className="px-3 md:px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
              <td className="px-3 md:px-4 py-3 text-zinc-300">{r.plan}</td>
              <td className={`px-4 py-3 text-zinc-400 whitespace-nowrap ${WIDE}`}>{trial(r)}</td>
              <td className={`px-4 py-3 text-zinc-300 font-mono ${WIDE}`}>{r.devices}</td>
              <td className={`px-4 py-3 text-zinc-400 whitespace-nowrap ${WIDE}`}>{timeAgo(r.last_seen_at)}</td>
              <td className="px-3 md:px-4 py-3">{r.open_tickets ? <Badge tone="amber">{`${r.open_tickets} open`}</Badge> : <span className="text-zinc-600">—</span>}</td>
              <td className={`px-4 py-3 text-zinc-400 font-mono whitespace-nowrap ${WIDE}`}>{formatBytes(r.db_bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="px-4 py-8 text-center text-zinc-600 text-xs">No restaurants match.</p>}
    </div>
  );
}