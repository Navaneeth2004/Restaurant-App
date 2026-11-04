import { useCallback, useEffect, useState } from 'react';
import { listTickets } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';
import { useDebouncedCallback } from 'hooks/async/useDebouncedCallback';
import type { TicketFilter } from 'types/office/root';

const SEARCH_DELAY_MS = 300;

/** Ticket list with filters. The search box is applied after a short pause, so typing does not fire a request per key. */
export function useTickets(restaurant: string) {
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const applySearch = useDebouncedCallback(setQ, SEARCH_DELAY_MS);
  useEffect(() => { applySearch(draft); }, [draft, applySearch]);

  const load = useCallback((s: AbortSignal) => listTickets({ status, severity, q, restaurant } satisfies TicketFilter, s), [status, severity, q, restaurant]);
  const list = useAsync(load);
  return { status, setStatus, severity, setSeverity, search: draft, setSearch: setDraft, ...list };
}
