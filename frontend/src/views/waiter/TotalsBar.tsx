/**
 * components/waiter/TotalsBar.tsx
 *
 * Running totals strip at the bottom of the order panel.
 *
 * FIX: direct-bill orders (delivered_at ≈ created_at) are not labeled as
 * "delivered" rounds — they're included in the total silently.
 * Only true kitchen rounds that went through the active state show as separate
 * line items with a round label.
 */

import React from 'react';
import type { Order } from '../../types';

type CartItem = { price: number; quantity: number };

/** Returns true if a delivered order was created via /direct-bill. */
function isDirectBill(order: Order): boolean {
  if (!order.delivered_at || !order.created_at) return false;
  const diff = Math.abs(
    new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()
  );
  return diff < 2000;
}

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

  const deliveredOrders    = allOrders.filter(o => o.status === 'delivered');
  const kitchenRounds      = deliveredOrders.filter(o => !isDirectBill(o));
  const directBillOrders   = deliveredOrders.filter(o => isDirectBill(o));
  const activeOrder        = allOrders.find(o => o.status === 'active') ?? null;
  const totalKitchenRounds = kitchenRounds.length;

  // Direct-bill orders are included in grandTotal but not shown as separate lines
  const directBillTotal = directBillOrders.reduce(
    (s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0
  );

  return (
    <div className="border-t border-surface-border px-3 py-2 space-y-1 flex-shrink-0">
      {/* Direct-bill items as a single line (not labeled as a round) */}
      {directBillTotal > 0 && (
        <div className="flex justify-between text-xs text-zinc-600">
          <span>Billed directly</span>
          <span className="font-mono">{sym}{directBillTotal.toFixed(2)}</span>
        </div>
      )}

      {/* True kitchen rounds */}
      {kitchenRounds.map((o, i) => {
        const roundTotal = o.items.reduce((s, it) => s + it.price * it.quantity, 0);
        const label = totalKitchenRounds > 1 ? `Round ${i + 1} (delivered)` : 'Delivered';
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
            {totalKitchenRounds > 0
              ? `Round ${totalKitchenRounds + 1} (in kitchen)`
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
