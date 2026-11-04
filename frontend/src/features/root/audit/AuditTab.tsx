import { useCallback } from 'react';
import { rootAudit } from 'api/platform/root.api';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useAsync } from 'hooks/async/useAsync';
import { formatDateTime } from 'lib/format/local-time';

const HEAD = ['When', 'Who', 'Action', 'Target', 'Details', 'IP'];

export default function AuditTab() {
  const load = useCallback((s: AbortSignal) => rootAudit(s), []);
  const { data, error, reload } = useAsync(load);
  if (!data) return error ? <ErrorNotice error={error} onRetry={reload} fallback="Could not load the audit log" /> : <PageSpinner />;
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border"><p className="text-sm font-bold text-white">Audit log</p><p className="text-zinc-500 text-xs mt-0.5">Everything done in the root console (newest first).</p></div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-surface-border text-left text-zinc-500">{HEAD.map(h => <th key={h} scope="col" className="px-4 py-2.5 font-bold uppercase tracking-widest text-[10px]">{h}</th>)}</tr></thead>
          <tbody>
            {data.map(a => (
              <tr key={a.id} className="border-b border-surface-border/50">
                <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">{formatDateTime(a.at)}</td><td className="px-4 py-2 text-zinc-300">{a.owner_phone ?? '—'}</td>
                <td className="px-4 py-2 text-white font-mono">{a.action}</td><td className="px-4 py-2 text-zinc-400 font-mono">{a.target ?? '—'}</td>
                <td className="px-4 py-2 text-zinc-500 max-w-xs truncate" title={a.detail ?? ''}>{a.detail ?? ''}</td><td className="px-4 py-2 text-zinc-500 font-mono">{a.ip ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <p className="px-4 py-6 text-zinc-600 text-xs">Nothing yet.</p>}
      </div>
    </div>
  );
}
