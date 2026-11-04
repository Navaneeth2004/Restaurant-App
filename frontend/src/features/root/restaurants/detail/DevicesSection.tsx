import { timeAgo } from 'lib/format/local-time';
import type { RootDevice } from 'types/office/root';
import { Section } from '../../ui/Layout';

const HEAD = ['Device', 'Lock', 'Linked by', 'Last seen', 'IP', 'Browser'];

export default function DevicesSection({ devices }: { devices: ReadonlyArray<RootDevice> }) {
  return (
    <Section title={`Linked devices (${devices.length})`}>
      {devices.length === 0 ? <p className="text-zinc-600 text-xs">No devices linked.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-zinc-500">{HEAD.map(h => <th key={h} scope="col" className="pb-2 pr-4 font-bold uppercase tracking-widest text-[10px]">{h}</th>)}</tr></thead>
            <tbody>{devices.map(x => (
              <tr key={x.id} className="border-t border-surface-border/50">
                <td className="py-2 pr-4 text-white">{x.name}</td><td className="py-2 pr-4 text-zinc-400">{x.role_lock ?? '—'}</td><td className="py-2 pr-4 text-zinc-400">{x.created_via ?? '—'}</td>
                <td className="py-2 pr-4 text-zinc-400 whitespace-nowrap">{timeAgo(x.last_seen_at)}</td><td className="py-2 pr-4 text-zinc-400 font-mono">{x.last_ip ?? '—'}</td>
                <td className="py-2 text-zinc-500 max-w-[220px] truncate" title={x.user_agent ?? ''}>{x.user_agent ?? '—'}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
