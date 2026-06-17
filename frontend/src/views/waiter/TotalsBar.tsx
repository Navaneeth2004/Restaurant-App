/**
 * components/waiter/TotalsBar.tsx
 *
 * Running totals strip at the bottom of the order panel.
 * Extracted from WaiterView.tsx.
 */

import React from 'react';
import type { Order } from '../../types';

type CartItem = { price: number; quantity: number };

interface Props {
  allOrders:  Order[];
  cart:       CartItem[];
  sym:        string;
  cartTotal:  number;
  grandTotal: number;
}

export default function TotalsBar({ allOrders, cart, sym, cartTotal, grandTotal }: Props) {
  const hasContent = cart.length > 0 || allOrders.length > 0;
  if (!hasContent) return null;

  const deliveredOrders = allOrders.filter(o => o.status === 'delivered');
  const activeOrder     = allOrders.find(o => o.status === 'active') ?? null;
  const totalRounds     = allOrders.length;

  return (
    <div className="border-t border-surface-border px-3 py-2 space-y-1 flex-shrink-0">
      {deliveredOrders.map((o, i) => {
        const roundTotal = o.items.reduce((s, it) => s + it.price * it.quantity, 0);
        const label = totalRounds > 1 ? `Round ${i + 1} (delivered)` : 'Delivered';
        return (
          <div key={o.id} className="flex justify-between text-xs text-zinc-600">
            <span>{label}</span>
            <span className="font-mono">{sym}{roundTotal.toFixed(2)}</span>
          </div>
        );
      })}

      {activeOrder && (
        <div className="flex justify-between text-xs text-zinc-500">
          <span>
            {totalRounds > 1
              ? `Round ${deliveredOrders.length + 1} (in kitchen)`
              : 'In kitchen'}
          </span>
          <span className="font-mono">
            {sym}{activeOrder.items.reduce((s, it) => s + it.price * it.quantity, 0).toFixed(2)}
          </span>
        </div>
      )}

      {cart.length > 0 && (
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{activeOrder ? 'Pending (unsent)' : 'New order (unsent)'}</span>
          <span className="font-mono">{sym}{cartTotal.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm font-semibold text-white pt-1 border-t border-surface-border">
        <span>Total</span>
        <span className="font-mono">{sym}{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
}