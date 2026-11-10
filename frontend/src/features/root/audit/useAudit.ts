import { useCallback, useEffect, useState } from 'react';
import { rootAudit } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';
import { useDebouncedCallback } from 'hooks/async/useDebouncedCallback';
import type { AuditSource } from 'types/office/audit';

export const AUDIT_PAGE = 50;
const SEARCH_DELAY_MS = 300;

/** One page of the log at a time. It asks for one extra row to know whether an older page exists. */
export function useAudit() {
  const [source, setSourceState] = useState<AuditSource>('all');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const applySearch = useDebouncedCallback((v: string) => { setQ(v); setPage(0); }, SEARCH_DELAY_MS);
  useEffect(() => { applySearch(draft); }, [draft, applySearch]);

  const load = useCallback((s: AbortSignal) => rootAudit({ q, source, limit: AUDIT_PAGE + 1, offset: page * AUDIT_PAGE }, s), [q, source, page]);
  const list = useAsync(load);
  const setSource = useCallback((s: AuditSource) => { setSourceState(s); setPage(0); }, []);

  return {
    ...list, source, setSource, search: draft, setSearch: setDraft, page, setPage,
    rows: (list.data ?? []).slice(0, AUDIT_PAGE), hasOlder: (list.data?.length ?? 0) > AUDIT_PAGE,
  };
}