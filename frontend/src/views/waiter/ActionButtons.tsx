/**
 * components/waiter/ActionButtons.tsx
 *
 */

import React, { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import type { Order, Table } from '../../types';

interface Props {
  loading:          boolean;
  cart:             { menu_item_id: number }[];
  selectedTable:    Table | null;
  hasBillableOrder: boolean;
  activeRound:      Order | null;
  sendToKitchen:    () => void;
  onBill:           () => void;
  clearCart:        () => void;
}

export default function ActionButtons({
  loading,
  cart,
  selectedTable,
  hasBillableOrder,
  activeRound,
  sendToKitchen,
  onBill,
  clearCart,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBill,  setConfirmBill]  = useState(false);

  // Send to Kitchen is only disabled when there's nothing in the cart
  // or no table selected. The table's current status (waiting_bill etc.)
  // does NOT block this — a waiter may add a new round at any time.
  const canSendToKitchen = !loading && cart.length > 0 && !!selectedTable;

  // Generate Bill is enabled when there's anything to bill
  const canGenerateBill = hasBillableOrder;

  const hasUnsentItems = cart.length > 0;

  return (
    <div className="p-3 flex flex-col gap-2 border-t border-surface-border flex-shrink-0">
      {confirmClear && (
        <ConfirmModal
          title="Clear New Items"
          message="This removes everything you've added that hasn't been sent to the kitchen yet. This cannot be undone."
          confirmLabel="Clear Items"
          danger
          onConfirm={() => { setConfirmClear(false); clearCart(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {confirmBill && (
        <ConfirmModal
          title="Generate Bill"
          message={
            hasUnsentItems
              ? "This will bill the new items in your cart directly (without sending them to the kitchen) and open the bill for this table."
              : "This will open the bill for this table so you can review items and take payment."
          }
          confirmLabel="Generate Bill"
          onConfirm={() => { setConfirmBill(false); onBill(); }}
          onCancel={() => setConfirmBill(false)}
        />
      )}

      <button
        onClick={sendToKitchen}
        disabled={!canSendToKitchen}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border bg-brand-500 hover:bg-brand-600 text-white border-brand-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600"
      >
        {loading ? 'Sending…' : activeRound ? 'Add to Order' : 'Send to Kitchen'}
      </button>

      <button
        onClick={() => setConfirmBill(true)}
        disabled={!canGenerateBill}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600"
      >
        Generate Bill
      </button>

      {cart.length > 0 && (
        <button
          onClick={() => setConfirmClear(true)}
          className="w-full py-1.5 rounded-xl text-xs font-medium bg-red-500/8 hover:bg-red-500/15 text-red-400/80 border border-red-500/15 transition-all"
        >
          Clear New Items
        </button>
      )}
    </div>
  );
}