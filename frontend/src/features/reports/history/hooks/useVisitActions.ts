import { useState } from 'react';
import { deleteRecords } from 'api/restaurant/orders.api';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useToastAction } from 'hooks/async/useToastAction';
import type { Visit } from 'lib/orders/visits';

/** Delete flow of one visit: explain → admin PIN → delete. The server re-checks the PIN. `onChanged` reloads the list. */
export function useVisitActions(visit: Visit, description: string, onChanged: () => void) {
  const { ask, dialog } = useConfirmAction();
  const [pinOpen, setPinOpen] = useState(false);
  const { busy, run } = useToastAction();

  const askDelete = (): void => ask({
    title: 'Delete this record?', confirmLabel: 'Continue', danger: true,
    message: `${description}. It will be permanently removed from history, revenue and GST reports and cannot be restored. A record of the deletion is kept in Reports → Deleted.`,
    action: async () => { setPinOpen(true); },
  });
  const remove = async (pin: string): Promise<void> => {
    setPinOpen(false);
    const ok = await run(() => deleteRecords(visit.orders.map(o => o.id), pin), { success: 'Record deleted', failure: 'Delete failed' });
    if (ok) onChanged();
  };
  return { dialog, pinOpen, closePin: () => setPinOpen(false), askDelete, remove, busy };
}
