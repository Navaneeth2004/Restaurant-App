/**
 * components/waiter/MenuGrid.tsx
 *
 * Grid of tappable menu item cards.
 *
 * NEW: `inlineControls` (used on phones) puts a "+" button on every card
 * and, once the item is in the order, a "− qty +" stepper in the top-right
 * corner of the photo, so quantities can be changed right here without
 * switching to the Order tab. The card is now a <div role="button"> because
 * a <button> cannot legally contain other buttons.
 */

import React from 'react';
import type { MenuItem, Table } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

type CartItem = {
  menu_item_id: number;
  name:  string;
  price: number;
  quantity: number;
  note: string;
};

interface Props {
  filtered:      MenuItem[];
  cart:          CartItem[];
  selectedTable: Table | null;
  sym:           string;
  addToCart:     (item: MenuItem) => void;
  updateQty?:    (idx: number, delta: number) => void;
  inlineControls?: boolean;
  cols?:         string;
}

const MinusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export default function MenuGrid({
  filtered,
  cart,
  selectedTable,
  sym,
  addToCart,
  updateQty,
  inlineControls = false,
  cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
}: Props) {
  // Remove one of this item. Prefers the plain (no-note) row; if every row for
  // the item has a note, takes one off the most recently added row.
  const decrease = (itemId: number) => {
    if (!updateQty) return;
    let idx = cart.findIndex(c => c.menu_item_id === itemId && !c.note);
    if (idx === -1) {
      for (let i = cart.length - 1; i >= 0; i--) {
        if (cart[i].menu_item_id === itemId) { idx = i; break; }
      }
    }
    if (idx !== -1) updateQty(idx, -1);
  };

  return (
    <div className={`grid ${cols} gap-3`}>
      {filtered.map(item => {
        const cartQty = cart
          .filter(c => c.menu_item_id === item.id)
          .reduce((s, c) => s + c.quantity, 0);
        const inCart   = cartQty > 0;
        const canOrder = !!item.available && !!selectedTable;
        const showStepper = inlineControls && canOrder && !!updateQty;

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={canOrder ? 0 : -1}
            aria-disabled={!canOrder}
            onClick={() => { if (canOrder) addToCart(item); }}
            onKeyDown={e => {
              if (canOrder && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addToCart(item); }
            }}
            className={`text-left rounded-xl border overflow-hidden bg-surface-card transition-all duration-150 relative select-none
              ${inCart ? 'border-brand-500/70 shadow-md shadow-brand-500/15' : ''}
              ${canOrder
                ? 'hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 active:scale-95 cursor-pointer'
                : 'border-surface-border opacity-40 cursor-not-allowed'}
              ${!inCart ? 'border-surface-border' : ''}`}
          >
            <div className="relative w-full bg-surface-raised overflow-hidden" style={{ paddingTop: '65%' }}>
              <div className="absolute inset-0">
                {item.image_path
                  ? <img src={`${API_BASE}${item.image_path}`} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-[10px]">No image</div>}
                {!item.available && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-red-500/80 px-2 py-0.5 rounded-full">
                      Sold Out
                    </span>
                  </div>
                )}
              </div>

              {showStepper ? (
                inCart ? (
                  <div
                    className="absolute top-1.5 right-1.5 flex items-center rounded-full bg-brand-500 border-2 border-surface-card shadow-lg"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={`Remove one ${item.name}`}
                      onClick={e => { e.stopPropagation(); decrease(item.id); }}
                      className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                      <MinusIcon />
                    </button>
                    <span className="min-w-[22px] text-center font-mono font-bold text-white text-sm leading-none">
                      {cartQty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add one ${item.name}`}
                      onClick={e => { e.stopPropagation(); addToCart(item); }}
                      className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add ${item.name}`}
                    onClick={e => { e.stopPropagation(); addToCart(item); }}
                    className="absolute top-1.5 right-1.5 w-9 h-9 rounded-full bg-brand-500 border-2 border-surface-card shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform"
                  >
                    <PlusIcon />
                  </button>
                )
              ) : (
                inCart && (
                  <div className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand-500 border-2 border-surface-card flex items-center justify-center shadow-lg">
                    <span className="font-mono font-bold text-white text-[11px] leading-none">{cartQty}</span>
                  </div>
                )
              )}
            </div>

            <div className="p-2.5">
              <p className="text-xs font-semibold leading-snug line-clamp-2 text-white">{item.name}</p>
              {item.description && (
                <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-1">{item.description}</p>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <p className="font-mono font-semibold text-brand-400 text-sm">
                  {sym}{parseFloat(String(item.price)).toFixed(2)}
                </p>
                {inCart && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full">
                    In order
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-600">
          <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          </svg>
          <p className="text-sm">No items in this category</p>
        </div>
      )}
    </div>
  );
}