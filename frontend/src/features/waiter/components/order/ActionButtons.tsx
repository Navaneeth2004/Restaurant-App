import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import Spinner from 'components/ui/feedback/Spinner';

interface Props {
  busy: boolean; hasCart: boolean; hasTable: boolean; hasBillable: boolean; hasActiveRound: boolean;
  onSend: () => void; onBill: () => void; onClear: () => void;
}

export default function ActionButtons({ busy, hasCart, hasTable, hasBillable, hasActiveRound, onSend, onBill, onClear }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBill, setConfirmBill] = useState(false);
  const base = 'w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border disabled:opacity-35 disabled:cursor-not-allowed';

  return (
    <div className="p-3 flex flex-col gap-2 border-t border-surface-border flex-shrink-0">
      {confirmClear && (
        <ConfirmDialog title="Clear New Items" danger confirmLabel="Clear Items"
          message="This removes everything you've added that hasn't been sent to the kitchen yet. This cannot be undone."
          onConfirm={() => { setConfirmClear(false); onClear(); }} onCancel={() => setConfirmClear(false)} />
      )}
      {confirmBill && (
        <ConfirmDialog title="Generate Bill" confirmLabel="Generate Bill"
          message={hasCart
            ? 'This will bill the new items in your cart directly (without sending them to the kitchen) and open the bill for this table.'
            : 'This will open the bill for this table so you can review items and take payment.'}
          onConfirm={() => { setConfirmBill(false); onBill(); }} onCancel={() => setConfirmBill(false)} />
      )}
      <button type="button" onClick={onSend} disabled={busy || !hasCart || !hasTable}
        className={`${base} bg-brand-500 hover:bg-brand-600 text-white border-brand-600 disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600`}>
        {busy ? <span className="inline-flex items-center gap-2"><Spinner />Working…</span> : hasActiveRound ? 'Add to Order' : 'Send to Kitchen'}
      </button>
      <button type="button" onClick={() => setConfirmBill(true)} disabled={busy || !hasBillable}
        className={`${base} bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30 disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600`}>
        Generate Bill
      </button>
      {hasCart && (
        <button type="button" onClick={() => setConfirmClear(true)} disabled={busy}
          className="w-full py-1.5 rounded-xl text-xs font-medium bg-red-500/8 hover:bg-red-500/15 text-red-400/80 border border-red-500/15 transition-all">Clear New Items</button>
      )}
    </div>
  );
}
