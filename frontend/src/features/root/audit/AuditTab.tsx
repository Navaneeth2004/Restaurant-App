import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import PillTabs from 'components/layout/PillTabs';
import type { AuditSource } from 'types/office/audit';
import AuditRow from './AuditRow';
import { AUDIT_PAGE, useAudit } from './useAudit';

const SOURCES: ReadonlyArray<{ key: AuditSource; label: string }> = [
  { key: 'all', label: 'Everything' }, { key: 'app', label: 'Restaurants' }, { key: 'root', label: 'Root console' },
];

export default function AuditTab() {
  const a = useAudit();
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-white font-bold text-sm">Audit log</h2>
        <p className="text-zinc-500 text-xs mt-0.5 max-w-xl leading-relaxed">Logins, changes and deletions, by restaurants and in this console. Newest first, {AUDIT_PAGE} per page.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <PillTabs tabs={SOURCES} active={a.source} label="Audit source" onSelect={k => { const s = SOURCES.find(x => x.key === k); if (s) a.setSource(s.key); }} />
        <input aria-label="Search audit log" className="input sm:max-w-xs sm:flex-1" placeholder="Search action, phone, restaurant id, IP…" value={a.search} onChange={e => a.setSearch(e.target.value)} />
        <button type="button" className="btn btn-sm ml-auto" onClick={a.reload} disabled={a.loading}>Refresh</button>
      </div>
      <ErrorNotice error={a.error} onRetry={a.reload} fallback="Could not load the audit log" />
      {a.data === null ? (!a.error && <PageSpinner />) : a.rows.length === 0 ? <EmptyState title="Nothing found" hint="Try another search or filter." /> : (
        <ul className={`rounded-xl border border-surface-border bg-surface-card overflow-hidden ${a.loading ? 'opacity-60' : ''}`} aria-busy={a.loading}>
          {a.rows.map(r => <AuditRow key={r.id} entry={r} />)}
        </ul>
      )}
      {a.data !== null && (a.page > 0 || a.hasOlder) && (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn btn-sm" disabled={a.page === 0 || a.loading} onClick={() => a.setPage(a.page - 1)}>← Newer</button>
          <span className="text-zinc-500 text-xs">Page {a.page + 1}</span>
          <button type="button" className="btn btn-sm" disabled={!a.hasOlder || a.loading} onClick={() => a.setPage(a.page + 1)}>Older →</button>
        </div>
      )}
    </div>
  );
}