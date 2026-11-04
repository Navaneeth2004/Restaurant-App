import { useCallback, useMemo, useState } from 'react';
import { getReportHistory } from 'api/office/reports.api';
import { REPORT_HISTORY_LIMIT } from 'config/constants';
import { useAsync } from 'hooks/async/useAsync';
import { parseTaxPercent } from 'lib/orders/bill';
import { todayStr, validateRange } from 'lib/format/local-time';
import { sumLines } from 'lib/format/money';
import { groupVisits, Visit } from 'lib/orders/visits';
import { useSettings } from 'state/settings/useSettings';
import type { Order } from 'types/restaurant/orders';
import { matchesVisit } from './visit-search';

const NONE: Order[] = [];
interface Range { from: string; to: string }

/**
 * Closed visits for a date range. The From/To inputs are a draft: nothing is fetched until Search is pressed.
 * History is deliberately not live (rows appearing under the reader's finger is disorienting); it reloads after edits/deletes.
 */
export function useHistory() {
  const fallbackRate = parseTaxPercent(useSettings().tax_percent);
  const [draft, setDraft] = useState<Range>(() => ({ from: todayStr(), to: todayStr() }));
  const [applied, setApplied] = useState<Range>(draft);
  const [search, setSearch] = useState('');
  const rangeError = validateRange(draft.from, draft.to);

  const load = useCallback((s: AbortSignal) => getReportHistory(applied, s, REPORT_HISTORY_LIMIT), [applied]);
  const { data, loading, error, reload } = useAsync(load);

  const apply = useCallback(() => {
    if (rangeError) return;
    if (draft.from === applied.from && draft.to === applied.to) reload();
    else setApplied(draft);
  }, [rangeError, draft, applied, reload]);
  const today = useCallback(() => {
    const t = todayStr();
    const r = { from: t, to: t };
    setDraft(r);
    if (applied.from === t && applied.to === t) reload(); else setApplied(r);
  }, [applied, reload]);

  const visits = useMemo<Visit[]>(() => groupVisits(data ?? NONE, fallbackRate), [data, fallbackRate]);
  const shown = useMemo(() => visits.filter(v => matchesVisit(v, search)), [visits, search]);
  const total = useMemo(() => sumLines(shown.map(v => ({ price: v.total, quantity: 1 }))), [shown]);

  return {
    draft, setDraft, rangeError, search, setSearch, apply, today, reload,
    visits, shown, total, loading, error, loaded: data !== null,
    /** The server returned as many rows as it may: older orders in the range were cut off. */
    truncated: (data?.length ?? 0) >= REPORT_HISTORY_LIMIT,
    appliedRange: applied,
  };
}
