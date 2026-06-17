/**
 * components/waiter/OrderContent.tsx
 *
 * Scrollable order list showing past rounds, the active round,
 * and the unsent cart — with inline cancel controls.
 * Extracted from WaiterView.tsx.
 */

import React from 'react';
import type { Order, Table } from '../../types';

type CartItem = {
  menu_item_id: number;
  name:     string;
  price:    number;
  quantity: number;
  note:     string;
};

interface Props {
  pastRounds:    Order[];
  activeRound:   Order | null;
  allOrders:     Order[];
  cart:          CartItem[];
  selectedTable: Table | null;
  sym:           string;
  updateQty:     (idx: number, delta: number) => void;
  updateNote:    (idx: number, note: string) => void;
  onCancelItem?: (orderId: string, itemId: number) => void;
  onCancelRound?: (orderId: string) => void;
}

export default function OrderContent({
  pastRounds,
  activeRound,
  allOrders,
  cart,
  selectedTable,
  sym,
  updateQty,
  updateNote,
  onCancelItem,
  onCancelRound,
}: Props) {
  return (
    <>
      {/* Delivered rounds */}
      {pastRounds.map((round, roundIdx) => (
        <div key={round.id} className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                Round {roundIdx + 1} — Delivered
              </span>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              {sym}{round.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
            </span>
          </div>
          {round.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1 gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-zinc-400 text-xs font-medium">
                  <span className="text-zinc-500 font-bold">{item.quantity}×</span> {item.name}
                </span>
                {item.note && <div className="text-zinc-600 text-[10px] italic truncate">{item.note}</div>}
              </div>
              <span className="font-mono text-zinc-500 text-xs flex-shrink-0">
                {sym}{(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t border-surface-border mt-2" />
        </div>
      ))}

      {/* Active round (in kitchen) */}
      {activeRound && activeRound.items.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {pastRounds.length > 0 ? `Round ${pastRounds.length + 1}` : 'Active Order'} — In Kitchen
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">
                {sym}{activeRound.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
              </span>
              {onCancelRound && (
                <button
                  onClick={() => onCancelRound(activeRound.id)}
                  className="text-[10px] font-semibold text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                >
                  Cancel round
                </button>
              )}
            </div>
          </div>
          {activeRound.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1 gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-zinc-300 text-xs font-medium">
                  <span className="text-brand-400 font-bold">{item.quantity}×</span> {item.name}
                </span>
                {item.note && <div className="text-zinc-600 text-[10px] italic truncate">{item.note}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-zinc-400 text-xs">
                  {sym}{(item.price * item.quantity).toFixed(2)}
                </span>
                {onCancelItem && (
                  <button
                    onClick={() => onCancelItem(activeRound.id, item.id!)}
                    className="w-5 h-5 rounded flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove item"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          {cart.length > 0 && <div className="border-t border-surface-border mt-2" />}
        </div>
      )}

      {/* All-delivered nudge */}
      {!activeRound && pastRounds.length > 0 && cart.length === 0 && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            All delivered — add items or generate bill
          </p>
        </div>
      )}

      {/* Unsent cart */}
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-zinc-600">
          <div className="w-10 h-10 rounded-xl border border-surface-border flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-1.684 2.032-3.501 2.032-5.25a6 6 0 00-6-6 6 6 0 00-6 6c0 1.749.911 3.566 2.032 5.25z" />
            </svg>
          </div>
          <p className="text-xs text-center">
            {!selectedTable
              ? 'Select a table to start'
              : allOrders.length > 0
                ? 'Tap items to add another round'
                : 'Tap menu items to add'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-surface-border">
          {cart.length > 0 && (
            <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400">
                {activeRound
                  ? 'Adding to Current Round'
                  : allOrders.length > 0
                    ? `Round ${pastRounds.length + 1} — New Order`
                    : 'New Order'}
              </span>
            </div>
          )}
          {cart.map((item, idx) => (
            <div key={idx} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">{item.name}</p>
                  <p className="font-mono text-brand-400 text-xs mt-0.5">
                    {sym}{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => updateQty(idx, -1)}
                    className="w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm"
                  >−</button>
                  <span className="font-mono text-white text-xs w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(idx, +1)}
                    className="w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm"
                  >+</button>
                </div>
              </div>
              <input
                className="mt-1.5 w-full bg-surface-raised border border-surface-border rounded-lg px-2 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-brand-500/50"
                placeholder="Note, e.g. no onions"
                value={item.note}
                onChange={e => updateNote(idx, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}