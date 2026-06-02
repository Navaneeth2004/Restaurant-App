import React, { useState, useEffect, useCallback } from 'react';
import {
  getTables, getMenuItems, getCategories,
  getTableOrder, submitOrder
} from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useTick } from '../hooks/useTick';
import BillModal from '../components/BillModal';
import type { Table, MenuItem, Category, Order } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

type CartItem = {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  note: string;
};

export default function WaiterView() {
  const [tables,        setTables]        = useState<Table[]>([]);
  const [menuItems,     setMenuItems]     = useState<MenuItem[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrder,   setActiveOrder]   = useState<Order | null>(null);
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [activeCatId,   setActiveCatId]   = useState<number | null>(null);
  const [billModal,     setBillModal]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const toast    = useToast();
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  useTick(30000);

  const loadTables = useCallback(async () => {
    try { setTables(await getTables()); } catch {}
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([getMenuItems(), getCategories()]);
      setMenuItems(m);
      setCategories(c);
      setActiveCatId(id => id ?? (c[0]?.id ?? null));
    } catch (e) {
      console.error('Menu load error', e);
    }
  }, []);

  useEffect(() => { loadTables(); loadMenu(); }, []);

  useSocket('tables_updated',  loadTables);
  useSocket('menu_updated',    loadMenu);
  useSocket('categories_updated', loadMenu);
  useSocket('order_updated',   ({ order }: { order: Order }) => {
    if (selectedTable && order.table_id === selectedTable.id) setActiveOrder(order);
    loadTables();
  });
  useSocket('order_closed', () => {
    loadTables();
    setActiveOrder(null);
    setCart([]);
    setSelectedTable(null);
  });
  useSocket('order_delivered', () => loadTables());

  const selectTable = async (table: Table) => {
    if (selectedTable?.id === table.id) return;
    setSelectedTable(table);
    setCart([]);
    setActiveOrder(null);
    try {
      const ord = await getTableOrder(table.id);
      setActiveOrder(ord);
      // FIX #6: don't pre-fill cart with existing order items
      // Just show them as "previously ordered" — cart stays empty for new additions
      setCart([]);
    } catch {
      setActiveOrder(null);
      setCart([]);
    }
  };

  const addToCart = (item: MenuItem) => {
    if (!selectedTable) { toast('Select a table first', 'error'); return; }
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id && !c.note);
      if (idx !== -1) {
        const u = [...prev]; u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 }; return u;
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, note: '' }];
    });
  };

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => {
      const u = [...prev]; u[idx] = { ...u[idx], quantity: u[idx].quantity + delta };
      if (u[idx].quantity <= 0) u.splice(idx, 1);
      return u;
    });
  };

  const updateNote = (idx: number, note: string) => {
    setCart(prev => prev.map((it, i) => i === idx ? { ...it, note } : it));
  };

  const sendToKitchen = async () => {
    if (!selectedTable || !cart.length) { toast('Add items first', 'error'); return; }
    setLoading(true);
    try {
      // Merge with existing order items if there's an active order
      const allItems = activeOrder
        ? [...activeOrder.items.map(i => ({ menu_item_id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity, note: i.note })), ...cart]
        : cart;
      const order = await submitOrder({ table_id: selectedTable.id, items: allItems });
      setActiveOrder(order);
      setCart([]);
      toast(`Order sent for ${selectedTable.label}`, 'success');
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to send order', 'error');
    } finally { setLoading(false); }
  };

  const cartTotal    = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const filteredMenu = menuItems.filter(m => m.category_id === activeCatId);
  // FIX #7: table with waiting_bill status means order is delivered, bill ready
  const tableHasActiveOrder = (t: Table) => t.status === 'occupied' || t.status === 'waiting_bill';

  return (
    <div className="flex h-full overflow-hidden">

      {/* LEFT: Tables sidebar */}
      <aside className="w-44 xl:w-52 flex-shrink-0 flex flex-col border-r border-surface-border bg-surface-card">
        <div className="px-4 py-3 border-b border-surface-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Tables</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {tables.map(t => {
              const isSelected = selectedTable?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTable(t)}
                  className={`
                    relative rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer select-none
                    ${t.status === 'occupied'    ? 'border-brand-500/60 bg-brand-500/8 shadow-sm shadow-brand-500/10' : ''}
                    ${t.status === 'waiting_bill'? 'border-emerald-500/60 bg-emerald-500/8' : ''}
                    ${t.status === 'empty'       ? 'border-surface-border bg-surface-card hover:border-zinc-600' : ''}
                    ${isSelected                 ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-card' : ''}
                  `}
                >
                  {/* FIX #5: consistent font, aligned layout */}
                  <div className="font-mono font-bold text-base text-white leading-none">{t.id}</div>
                  <div className="text-zinc-500 text-[10px] mt-1 leading-none truncate">{t.label}</div>
                  <div className="mt-2">
                    {t.status === 'occupied'     && <span className="inline-block text-[9px] font-semibold uppercase tracking-wide text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full">Active</span>}
                    {t.status === 'waiting_bill' && <span className="inline-block text-[9px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">Bill</span>}
                    {t.status === 'empty'        && <span className="inline-block text-[9px] font-semibold uppercase tracking-wide text-zinc-600 px-1.5 py-0.5 rounded-full">Empty</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {tables.length === 0 && <p className="text-zinc-600 text-xs text-center py-8">No tables yet</p>}
        </div>
      </aside>

      {/* CENTRE: Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row — FIX #4: just show table name, not both label and id */}
        <div className="flex-shrink-0 px-4 pt-3 pb-0 border-b border-surface-border bg-surface-card/50">
          <div className="flex items-center gap-2 mb-2.5">
            {selectedTable ? (
              <span className="font-semibold text-white text-sm">{selectedTable.label}</span>
            ) : (
              <span className="text-zinc-500 text-sm">Select a table to start an order</span>
            )}
          </div>
          {/* FIX #8: scrollable category tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCatId(c.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150
                  ${activeCatId === c.id
                    ? 'bg-brand-500 text-white border-brand-600 shadow-sm shadow-brand-500/30'
                    : 'text-zinc-400 border-surface-border hover:text-white hover:border-zinc-600'
                  }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredMenu.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600">
              <div className="w-12 h-12 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
              </div>
              <p className="text-sm font-medium text-zinc-500">No items in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredMenu.map(item => (
                <button
                  key={item.id}
                  onClick={() => item.available ? addToCart(item) : null}
                  disabled={!item.available || !selectedTable}
                  className={`
                    text-left rounded-xl border overflow-hidden transition-all duration-150
                    ${item.available && selectedTable
                      ? 'border-surface-border hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 active:scale-95 cursor-pointer'
                      : 'border-surface-border opacity-40 cursor-not-allowed'
                    }
                    bg-surface-card
                  `}
                >
                  <div className="relative w-full h-28 bg-surface-raised overflow-hidden">
                    {item.image_path ? (
                      <img src={`${API_BASE}${item.image_path}`} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No image</div>
                    )}
                    {!item.available && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-red-500/80 px-2 py-0.5 rounded-full">Sold Out</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-white text-xs font-semibold leading-snug line-clamp-2">{item.name}</p>
                    {item.description && <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-1">{item.description}</p>}
                    <p className="font-mono font-semibold text-brand-400 text-sm mt-1.5">{sym}{parseFloat(String(item.price)).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Order panel */}
      <aside className="w-64 xl:w-72 flex-shrink-0 flex flex-col border-l border-surface-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <p className="font-semibold text-sm text-white">
            {selectedTable ? `Order — ${selectedTable.label}` : 'Order'}
          </p>
          <div className="flex gap-1.5">
            {activeOrder && <span className="text-[9px] font-bold uppercase tracking-wide text-brand-400 bg-brand-500/15 border border-brand-500/25 px-2 py-0.5 rounded-full">Sent</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* FIX #6: Show previously ordered items (read-only) */}
          {activeOrder && activeOrder.items.length > 0 && (
            <div className="px-3 py-2 border-b border-surface-border">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Previously Ordered</p>
              {activeOrder.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 opacity-60">
                  <div className="flex-1 min-w-0">
                    <span className="text-zinc-400 text-xs">{item.name}</span>
                    {item.note && <div className="text-zinc-600 text-[10px] truncate">{item.note}</div>}
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="font-mono text-zinc-600 text-xs">×{item.quantity}</span>
                    <span className="font-mono text-zinc-500 text-xs">{sym}{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New cart items */}
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-zinc-600">
              {!activeOrder && (
                <>
                  <div className="w-10 h-10 rounded-xl border border-surface-border flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-1.684 2.032-3.501 2.032-5.25a6 6 0 00-6-6 6 6 0 00-6 6c0 1.749.911 3.566 2.032 5.25z" /></svg>
                  </div>
                  <p className="text-xs text-center">{selectedTable ? 'Tap items to add' : 'Select a table to start'}</p>
                </>
              )}
              {activeOrder && (
                <p className="text-xs text-center text-zinc-600">Tap items to add more</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {cart.length > 0 && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 px-3 pt-2.5 mb-1">
                  {activeOrder ? 'New Items' : 'Order'}
                </p>
              )}
              {cart.map((item, idx) => (
                <div key={idx} className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold leading-snug">{item.name}</p>
                      <p className="font-mono text-brand-400 text-xs mt-0.5">{sym}{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm transition-colors">−</button>
                      <span className="font-mono text-white text-xs w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)}  className="w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm transition-colors">+</button>
                    </div>
                  </div>
                  <input
                    className="mt-1.5 w-full bg-surface-raised border border-surface-border rounded-lg px-2 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-brand-500/50 transition-colors"
                    placeholder="Note, e.g. no onions"
                    value={item.note}
                    onChange={e => updateNote(idx, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {(cart.length > 0 || (activeOrder && activeOrder.items.length > 0)) && (
          <div className="border-t border-surface-border px-3 py-2 space-y-1">
            {activeOrder && activeOrder.items.length > 0 && (
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Previous</span>
                <span className="font-mono">{sym}{activeOrder.items.reduce((s,i) => s+i.price*i.quantity,0).toFixed(2)}</span>
              </div>
            )}
            {cart.length > 0 && (
              <div className="flex justify-between text-xs text-zinc-400">
                <span>New items</span>
                <span className="font-mono">{sym}{cartTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-white pt-1 border-t border-surface-border">
              <span>Total</span>
              <span className="font-mono text-white">
                {sym}{((activeOrder?.items.reduce((s,i) => s+i.price*i.quantity,0) ?? 0) + cartTotal).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="p-3 flex flex-col gap-2 border-t border-surface-border">
          {/* FIX #6: disable send button when no new cart items */}
          <button
            onClick={sendToKitchen}
            disabled={loading || !cart.length || !selectedTable}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
              bg-brand-500 hover:bg-brand-600 text-white border border-brand-600 shadow-sm shadow-brand-500/20
              disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600 disabled:shadow-none"
          >
            {loading ? 'Sending…' : activeOrder ? 'Add to Order' : 'Send to Kitchen'}
          </button>

          {/* FIX #6: Generate Bill — green when active, disabled when not */}
          <button
            onClick={() => {
              if (!activeOrder) { toast('No active order for this table', 'error'); return; }
              setBillModal(true);
            }}
            disabled={!activeOrder}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95
              disabled:opacity-35 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:border-surface-border disabled:text-zinc-600
              bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
          >
            Generate Bill
          </button>

          <button
            onClick={() => setCart([])}
            disabled={!cart.length}
            className="w-full py-2 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
              bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
          >
            Clear New Items
          </button>
        </div>
      </aside>

      {/* Bill modal */}
      {billModal && activeOrder && selectedTable && (
        <BillModal
          order={activeOrder}
          table={selectedTable}
          onClose={() => setBillModal(false)}
          onClosed={() => {
            setBillModal(false);
            setSelectedTable(null);
            setCart([]);
            setActiveOrder(null);
            loadTables();
          }}
        />
      )}
    </div>
  );
}
