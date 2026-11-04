import { useCallback, useEffect, useState } from 'react';
import { getTicket, updateTicket } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';
import { useToastAction } from 'hooks/async/useToastAction';
import type { TicketStatus } from 'types/office/support';

/** One ticket plus the operator's status/note form. Saving reloads it and the list. */
export function useTicket(id: number, onChanged: () => void) {
  const load = useCallback((s: AbortSignal) => getTicket(id, s), [id]);
  const { data, error, reload } = useAsync(load);
  const [status, setStatus] = useState<TicketStatus>('open');
  const [note, setNote] = useState('');
  const { busy, run } = useToastAction();
  useEffect(() => { if (data) { setStatus(data.status); setNote(data.root_note ?? ''); } }, [data]);

  const save = (): Promise<boolean> => run(async () => { await updateTicket(id, { status, root_note: note }); reload(); onChanged(); }, { success: 'Saved.', failure: 'Could not save the ticket' });
  return { data, error, reload, status, setStatus, note, setNote, save, busy };
}
