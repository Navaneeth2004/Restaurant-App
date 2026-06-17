/**
 * components/waiter/ActionButtons.tsx
 *
 * Send to Kitchen / Generate Bill / Clear buttons at the bottom of the order panel.
 * Extracted from WaiterView.tsx.
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
  return (
    <div className="p-3 flex flex-col gap-2 border-t border-surface-border flex-shrink-0">
      <button
        onClick={sendToKitchen}
        disabled={loading || !cart.length || !selectedTable}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border bg-brand-500 hover:bg-brand-600 text-white border-brand-600 disabled:opacity-35 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600"
      >
        {loading ? 'Sending…' : activeRound ? 'Add to Order' : 'Send to Kitchen'}
      </button>

      <button
        onClick={onBill}
        disabled={!hasBillableOrder}
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