/**
 * components/waiter/ActionButtons.tsx
 *
 * FIXES:
 * 1. "Send to Kitchen" is disabled ONLY when cart is empty or no table is selected.
 *    It is NOT disabled because of the table's billing state (waiting_bill) or
 *    because a direct-bill was done. Those are separate concerns.
 * 2. "Generate Bill" is enabled whenever there is anything to bill
 *    (sent orders OR unsent cart items).
 * 3. Button label logic: "Add to Order" if there is an active kitchen round,
 *    otherwise "Send to Kitchen".
 */

import React from 'react';
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
  // Send to Kitchen is only disabled when there's nothing in the cart
  // or no table selected. The table's current status (waiting_bill etc.)
  // does NOT block this — a waiter may add a new round at any time.
  const canSendToKitchen = !loading && cart.length > 0 && !!selectedTable;

  // Generate Bill is enabled when there's anything to bill
  const canGenerateBill = hasBillableOrder;

  return (
    <div className="p-3 flex flex-col gap-2 border-t border-surface-border flex-shrink-0">
      <button
        onClick={sendToKitchen}
        disabled={!canSendToKitchen}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border bg-brand-500 hover:bg-brand-600 text-white border-brand-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600"
      >
        {loading ? 'Sending…' : activeRound ? 'Add to Order' : 'Send to Kitchen'}
      </button>

      <button
        onClick={onBill}
        disabled={!canGenerateBill}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600"
      >
        Generate Bill
      </button>

      {cart.length > 0 && (
        <button
          onClick={clearCart}
          className="w-full py-1.5 rounded-xl text-xs font-medium bg-red-500/8 hover:bg-red-500/15 text-red-400/80 border border-red-500/15 transition-all"
        >
          Clear New Items
        </button>
      )}
    </div>
  );
}
