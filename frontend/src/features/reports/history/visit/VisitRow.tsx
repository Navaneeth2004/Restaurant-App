import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import Icon from 'components/ui/base/Icon';
import PinModal from 'components/pin/PinModal';
import { checkPin } from 'api/access/staff.api';
import { tableDisplayLabel } from 'lib/input/ids';
import { formatDate } from 'lib/format/local-time';
import { formatMoney } from 'lib/format/money';
import type { Visit } from 'lib/orders/visits';
import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';
import PaymentEditModal from '../../payment/components/PaymentEditModal';
import { useVisitActions } from '../hooks/useVisitActions';
import ReprintBill from './ReprintBill';
import VisitDetails from './VisitDetails';
import VisitSummary from './VisitSummary';

interface Props { visit: Visit; sym: string; onChanged: () => void }

const ACTION = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors';

/** One closed visit. It holds no copy of the data: after an edit or delete the list reloads and the row shows the server's truth. */
export default function VisitRow({ visit, sym, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [bill, setBill] = useState(false);
  const [edit, setEdit] = useState(false);
  const { isOn } = useFeatures();
  const description = `${tableDisplayLabel(visit.tableId)} · ${formatDate(visit.startedAt)} · ${formatMoney(visit.total, sym)}`;
  const del = useVisitActions(visit, description, onChanged);

  return (
    <>
      {bill && <ReprintBill visit={visit} onClose={() => setBill(false)} />}
      {edit && <PaymentEditModal visit={visit} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); onChanged(); }} />}
      {del.dialog && <ConfirmDialog {...del.dialog} />}
      {del.pinOpen && <PinModal title="Admin PIN required" subtitle="Enter the admin PIN to delete this record" verify={checkPin} onSuccess={pin => void del.remove(pin)} onCancel={del.closePin} />}

      <div className={`rounded-xl border border-surface-border bg-surface-card overflow-hidden hover:border-zinc-600 transition-colors ${del.busy ? 'opacity-50 pointer-events-none' : ''}`}>
        <VisitSummary visit={visit} sym={sym} expanded={open} onToggle={() => setOpen(o => !o)} />
        {open && (
          <>
            <VisitDetails visit={visit} sym={sym} />
            <div className="px-4 py-3 border-t border-surface-border/60 flex gap-2 flex-wrap">
              <button type="button" onClick={() => setBill(true)} className={`${ACTION} bg-brand-500/10 border-brand-500/25 text-brand-400 hover:bg-brand-500/20`}><Icon name="printer" className="w-3.5 h-3.5" />Print Bill</button>
              {isOn(FEATURE.paymentEdit) && <button type="button" onClick={() => setEdit(true)} className={`${ACTION} bg-surface-raised border-surface-border text-zinc-400 hover:text-white hover:border-zinc-500`}><Icon name="card" className="w-3.5 h-3.5" />{visit.paymentMethod ? 'Edit Payment' : 'Add Payment'}</button>}
              {isOn(FEATURE.deleteRecords) && <button type="button" onClick={del.askDelete} className={`${ACTION} ml-auto bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20`}><Icon name="trash" className="w-3.5 h-3.5" />Delete</button>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
