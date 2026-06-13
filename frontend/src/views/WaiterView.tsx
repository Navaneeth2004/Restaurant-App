import React, { useState, useEffect, useCallback } from 'react';
import { getTables, getMenuItems, getCategories, getTableOrder, getTableOrders, submitOrder, cancelOrderItem, cancelOrder } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useTick } from '../hooks/useTick';
import { playChime, playDeliveryChime } from '../utils/sound';
import { reorderLock } from '../utils/reorderLock';
import BillModal from '../components/BillModal';
import TableTimer from '../components/TableTimer';
import ConfirmModal from '../components/ConfirmModal';
import type { Table, MenuItem, Category, Order } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
type CartItem = { menu_item_id: number; name: string; price: number; quantity: number; note: string; };
type MobileTab = 'tables' | 'menu' | 'order';

interface CatTabsProps {
  categories: Category[];
  activeCatId: number | null;
  setActiveCatId: (id: number) => void;
}
function CatTabs({ categories, activeCatId, setActiveCatId }: CatTabsProps) {
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-2"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; }}
    >
      {categories.map(c => (
        <button
          key={c.id}
          onClick={() => setActiveCatId(c.id)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${activeCatId === c.id
              ? 'bg-brand-500 text-white border-brand-600 shadow-sm'
              : 'text-zinc-400 border-surface-border hover:text-white hover:border-zinc-600'}`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

interface MenuGridProps {
  filtered: MenuItem[];
  cart: CartItem[];
  selectedTable: Table | null;
  sym: string;
  addToCart: (item: MenuItem) => void;
  cols?: string;
}
function MenuGrid({ filtered, cart, selectedTable, sym, addToCart, cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' }: MenuGridProps) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {filtered.map(item => {
        const cartQty = cart.filter(c => c.menu_item_id === item.id).reduce((s, c) => s + c.quantity, 0);
        const inCart  = cartQty > 0;
        return (
          <button
            key={item.id}
            onClick={() => item.available && selectedTable ? addToCart(item) : null}
            disabled={!item.available || !selectedTable}
            className={`text-left rounded-xl border overflow-hidden bg-surface-card transition-all duration-150 relative
              ${inCart ? 'border-brand-500/70 shadow-md shadow-brand-500/15' : ''}
              ${item.available && selectedTable ? 'hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 active:scale-95 cursor-pointer' : 'border-surface-border opacity-40 cursor-not-allowed'}
              ${!inCart ? 'border-surface-border' : ''}`}
          >
            <div className="relative w-full bg-surface-raised overflow-hidden" style={{ paddingTop: '65%' }}>
              <div className="absolute inset-0">
                {item.image_path
                  ? <img src={`${API_BASE}${item.image_path}`} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-[10px]">No image</div>}
                {!item.available && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-red-500/80 px-2 py-0.5 rounded-full">Sold Out</span>
                  </div>
                )}
              </div>
              {inCart && (
                <div className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand-500 border-2 border-surface-card flex items-center justify-center shadow-lg">
                  <span className="font-mono font-bold text-white text-[11px] leading-none">{cartQty}</span>
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-semibold leading-snug line-clamp-2 text-white">{item.name}</p>
              {item.description && <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-1">{item.description}</p>}
              <div className="flex items-center justify-between mt-1.5">
                <p className="font-mono font-semibold text-brand-400 text-sm">{sym}{parseFloat(String(item.price)).toFixed(2)}</p>
                {inCart && <span className="text-[9px] font-bold uppercase tracking-wide text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full">In order</span>}
              </div>
            </div>
          </button>
        );
      })}
      {filtered.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-600">
          <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
          <p className="text-sm">No items in this category</p>
        </div>
      )}
    </div>
  );
}

interface OrderContentProps {
  pastRounds: Order[];
  activeRound: Order | null;
  allOrders: Order[];
  cart: CartItem[];
  selectedTable: Table | null;
  sym: string;
  updateQty: (idx: number, d: number) => void;
  updateNote: (idx: number, note: string) => void;
  onCancelItem?: (orderId: string, itemId: number) => void;
  onCancelRound?: (orderId: string) => void;
}
function OrderContent({ pastRounds, activeRound, allOrders, cart, selectedTable, sym, updateQty, updateNote, onCancelItem, onCancelRound }: OrderContentProps) {
  return (
    <>
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
                <span className="font-mono text-zinc-400 text-xs">{sym}{(item.price * item.quantity).toFixed(2)}</span>
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

      {!activeRound && pastRounds.length > 0 && cart.length === 0 && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            All delivered — add items or generate bill
          </p>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-zinc-600">
          <div className="w-10 h-10 rounded-xl border border-surface-border flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-1.684 2.032-3.501 2.032-5.25a6 6 0 00-6-6 6 6 0 00-6 6c0 1.749.911 3.566 2.032 5.25z" /></svg>
          </div>
          <p className="text-xs text-center">
            {!selectedTable ? 'Select a table to start' : allOrders.length > 0 ? 'Tap items to add another round' : 'Tap menu items to add'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-surface-border">
          {cart.length > 0 && (
            <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400">
                {allOrders.length > 0 ? `New Items — Round ${pastRounds.length + (activeRound ? 2 : 1)}` : 'Order'}
              </span>
            </div>
          )}
          {cart.map((item, idx) => (
            <div key={idx} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">{item.name}</p>
                  <p className="font-mono text-brand-400 text-xs mt-0.5">{sym}{(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm">−</button>
                  <span className="font-mono text-white text-xs w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(idx, +1)} className="w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm">+</button>
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

interface TotalsBarProps {
  allOrders: Order[];
  cart: CartItem[];
  sym: string;
  cartTotal: number;
  grandTotal: number;
}
function TotalsBar({ allOrders, cart, sym, cartTotal, grandTotal }: TotalsBarProps) {
  const hasContent = cart.length > 0 || allOrders.length > 0;
  if (!hasContent) return null;
  return (
    <div className="border-t border-surface-border px-3 py-2 space-y-1 flex-shrink-0">
      {allOrders.map((o, i) => {
        const roundTotal = o.items.reduce((s, it) => s + it.price * it.quantity, 0);
        return (
          <div key={o.id} className="flex justify-between text-xs text-zinc-600">
            <span>{allOrders.length > 1 ? `Round ${i + 1}` : o.status === 'delivered' ? 'Delivered' : 'Previous'}</span>
            <span className="font-mono">{sym}{roundTotal.toFixed(2)}</span>
          </div>
        );
      })}
      {cart.length > 0 && (
        <div className="flex justify-between text-xs text-zinc-400">
          <span>New items</span>
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

interface ActionButtonsProps {
  loading: boolean;
  cart: CartItem[];
  selectedTable: Table | null;
  hasBillableOrder: boolean;
  activeRound: Order | null;
  sendToKitchen: () => void;
  onBill: () => void;
  clearCart: () => void;
}
function ActionButtons({ loading, cart, selectedTable, hasBillableOrder, activeRound, sendToKitchen, onBill, clearCart }: ActionButtonsProps) {
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

export default function WaiterView() {
  const [tables,        setTables]        = useState<Table[]>([]);
  const [menuItems,     setMenuItems]     = useState<MenuItem[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrder,   setActiveOrder]   = useState<Order | null>(null);
  const [allOrders,     setAllOrders]     = useState<Order[]>([]);
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [activeCatId,   setActiveCatId]   = useState<number | null>(null);
  const [billModal,     setBillModal]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [mobileTab,     setMobileTab]     = useState<MobileTab>('tables');
  // Themed confirm modal state
  const [confirmModal,  setConfirmModal]  = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

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
      setMenuItems(m); setCategories(c);
      setActiveCatId(id => id ?? (c[0]?.id ?? null));
    } catch {}
  }, []);

  const loadTableOrders = useCallback(async (tableId: string) => {
    try {
      const orders = await getTableOrders(tableId);
      setAllOrders(orders);
      const active    = orders.find(o => o.status === 'active') || null;
      const delivered = orders.filter(o => o.status === 'delivered');
      setActiveOrder(active ?? (delivered.length > 0 ? delivered[delivered.length - 1] : null));
    } catch {
      setAllOrders([]);
      setActiveOrder(null);
    }
  }, []);

  useEffect(() => { loadTables(); loadMenu(); }, []);

  useSocket('tables_updated', loadTables);
  useSocket('menu_updated', () => {
    if (reorderLock.isLocked()) return;
    loadMenu();
  });
  useSocket('categories_updated', loadMenu);

  useSocket('order_updated', ({ order }: { order: Order }) => {
    if (selectedTable && order.table_id === selectedTable.id) loadTableOrders(selectedTable.id);
    loadTables();
  });

  useSocket('order_closed', ({ tableId }: { tableId: string }) => {
    loadTables();
    if (selectedTable && tableId === selectedTable.id) {
      setActiveOrder(null); setAllOrders([]); setCart([]); setSelectedTable(null);
    }
  });

  useSocket('order_delivered', ({ order }: { order: Order }) => {
    loadTables();
    if (selectedTable && order.table_id === selectedTable.id) loadTableOrders(selectedTable.id);
    playDeliveryChime();
    const tableLabel = tables.find(t => t.id === order.table_id)?.label || `Table ${order.table_id}`;
    toast(`🍽️ Order ready — ${tableLabel}`, 'success');
  });

  const selectTable = async (table: Table) => {
    setSelectedTable(table);
    setCart([]);
    setActiveOrder(null);
    setAllOrders([]);
    setMobileTab('menu');
    await loadTableOrders(table.id);
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

  const updateQty = (idx: number, d: number) => setCart(prev => {
    const u = [...prev];
    u[idx] = { ...u[idx], quantity: u[idx].quantity + d };
    if (u[idx].quantity <= 0) u.splice(idx, 1);
    return [...u];
  });

  const updateNote = (idx: number, note: string) =>
    setCart(prev => prev.map((it, i) => i === idx ? { ...it, note } : it));

  const sendToKitchen = async () => {
    if (!selectedTable || !cart.length) { toast('Add items first', 'error'); return; }
    setLoading(true);
    try {
      const activeItems = activeOrder?.status === 'active'
        ? activeOrder.items.map(i => ({ menu_item_id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity, note: i.note }))
        : [];
      await submitOrder({ table_id: selectedTable.id, items: [...activeItems, ...cart] });
      setCart([]);
      toast(`Order sent for ${selectedTable.label}`, 'success');
      setMobileTab('order');
      await loadTableOrders(selectedTable.id);
    } catch (e: any) { toast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  // Themed confirm for cancel item
  const cancelItem = (orderId: string, itemId: number) => {
    setConfirmModal({
      title: 'Remove Item',
      message: 'This item will be removed from the order and the kitchen will be notified.',
      confirmLabel: 'Remove Item',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await cancelOrderItem(orderId, itemId);
          toast('Item removed', 'success');
          if (selectedTable) await loadTableOrders(selectedTable.id);
          loadTables();
        } catch (e: any) { toast(e.response?.data?.error || 'Failed', 'error'); }
      },
    });
  };

  // Themed confirm for cancel round
  const cancelRound = (orderId: string) => {
    setConfirmModal({
      title: 'Cancel Entire Round',
      message: 'All items in this round will be cancelled. The kitchen will be notified to stop preparing them.',
      confirmLabel: 'Cancel Round',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await cancelOrder(orderId);
          toast('Round cancelled', 'success');
          setCart([]);
          if (selectedTable) await loadTableOrders(selectedTable.id);
          loadTables();
        } catch (e: any) { toast(e.response?.data?.error || 'Failed', 'error'); }
      },
    });
  };

  const allOrdersTotal = allOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0);
  const cartTotal      = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const grandTotal     = allOrdersTotal + cartTotal;

  const hasBillableOrder = allOrders.length > 0;
  const billOrderId      = allOrders.length > 0 ? allOrders[allOrders.length - 1].id : null;

  const filtered    = menuItems.filter(m => m.category_id === activeCatId);
  const isDelivered = activeOrder?.status === 'delivered';
  const pastRounds  = allOrders.filter(o => o.status === 'delivered');
  const activeRound = allOrders.find(o => o.status === 'active') || null;

  const handleBill = () => {
    if (!hasBillableOrder) { toast('No order for this table', 'error'); return; }
    setBillModal(true);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Themed confirm modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:flex h-full w-full overflow-hidden">
        {/* Tables sidebar */}
        <aside className="w-40 xl:w-48 flex-shrink-0 flex flex-col border-r border-surface-border bg-surface-card">
          <div className="px-3 py-2.5 border-b border-surface-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tables</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {tables.map(t => {
                const isSelected = selectedTable?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTable(t)}
                    className={`relative rounded-xl border p-2.5 text-left transition-all duration-150 cursor-pointer select-none
                      ${t.status === 'occupied'     ? 'border-brand-500/60 bg-brand-500/8'    : ''}
                      ${t.status === 'waiting_bill' ? 'border-emerald-500/60 bg-emerald-500/8' : ''}
                      ${t.status === 'empty'        ? 'border-surface-border hover:border-zinc-600' : ''}
                      ${isSelected                  ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-card' : ''}
                    `}
                  >
                    <div className="font-mono font-bold text-sm text-white leading-none">{t.id}</div>
                    <div className="text-zinc-500 text-[9px] mt-0.5 truncate">{t.label}</div>
                    <div className="mt-1.5 flex flex-col gap-1">
                      {t.status === 'occupied'     && <span className="text-[8px] font-bold uppercase text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full self-start">Active</span>}
                      {t.status === 'waiting_bill' && <span className="text-[8px] font-bold uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full self-start">Bill</span>}
                      {t.status === 'empty'        && <span className="text-[8px] font-bold uppercase text-zinc-700 px-1 py-0.5 rounded-full self-start">Empty</span>}
                      {/* Show timer for both occupied AND waiting_bill */}
                      {t.occupied_since && t.status !== 'empty' && (
                        <TableTimer since={t.occupied_since} compact />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Menu panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 pt-3 pb-0 border-b border-surface-border bg-surface-card/50">
            <div className="mb-2">
              {selectedTable
                ? <span className="font-semibold text-white text-sm">{selectedTable.label}</span>
                : <span className="text-zinc-500 text-sm">Select a table to start</span>}
            </div>
            <CatTabs categories={categories} activeCatId={activeCatId} setActiveCatId={setActiveCatId} />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MenuGrid filtered={filtered} cart={cart} selectedTable={selectedTable} sym={sym} addToCart={addToCart} />
          </div>
        </div>

        {/* Order panel */}
        <aside className="w-64 xl:w-72 flex-shrink-0 border-l border-surface-border bg-surface-card flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between flex-shrink-0">
            <p className="font-semibold text-sm text-white">
              {selectedTable ? `Order — ${selectedTable.label}` : 'Order'}
            </p>
            {activeOrder && selectedTable && (
              <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${isDelivered ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' : 'text-brand-400 bg-brand-500/15 border-brand-500/25'}`}>
                {isDelivered ? 'Delivered' : 'Active'}
              </span>
            )}
          </div>
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 px-4">
              <div className="w-10 h-10 rounded-xl border border-surface-border flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-1.684 2.032-3.501 2.032-5.25a6 6 0 00-6-6 6 6 0 00-6 6c0 1.749.911 3.566 2.032 5.25z" /></svg>
              </div>
              <p className="text-xs text-center">Select a table from the left to begin</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <OrderContent
                  pastRounds={pastRounds} activeRound={activeRound} allOrders={allOrders}
                  cart={cart} selectedTable={selectedTable} sym={sym}
                  updateQty={updateQty} updateNote={updateNote}
                  onCancelItem={cancelItem} onCancelRound={cancelRound}
                />
              </div>
              <TotalsBar allOrders={allOrders} cart={cart} sym={sym} cartTotal={cartTotal} grandTotal={grandTotal} />
              <ActionButtons
                loading={loading} cart={cart} selectedTable={selectedTable}
                hasBillableOrder={hasBillableOrder} activeRound={activeRound}
                sendToKitchen={sendToKitchen} onBill={handleBill} clearCart={() => setCart([])}
              />
            </>
          )}
        </aside>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="flex md:hidden flex-col h-full w-full overflow-hidden">
        <div className="flex-shrink-0 flex border-b border-surface-border bg-surface-card">
          {([
            { key: 'tables', label: 'Tables' },
            { key: 'menu',   label: selectedTable ? `Menu — ${selectedTable.id}` : 'Menu' },
            { key: 'order',  label: 'Order' },
          ] as { key: MobileTab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 relative ${mobileTab === tab.key ? 'text-brand-400 border-brand-500' : 'text-zinc-500 border-transparent'}`}
            >
              {tab.label}
              {tab.key === 'order' && cart.length > 0 && (
                <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">{cart.length}</span>
              )}
            </button>
          ))}
        </div>

        {mobileTab === 'tables' && (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-zinc-500 text-xs mb-3 text-center">Tap a table to select it, then go to Menu</p>
            <div className="grid grid-cols-3 gap-2">
              {tables.map(t => {
                const isSelected = selectedTable?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { selectTable(t); setMobileTab('menu'); }}
                    className={`rounded-xl border p-3 text-center transition-all active:scale-95 select-none
                      ${t.status === 'occupied'     ? 'border-brand-500/60 bg-brand-500/8'    : ''}
                      ${t.status === 'waiting_bill' ? 'border-emerald-500/60 bg-emerald-500/8' : ''}
                      ${t.status === 'empty'        ? 'border-surface-border'                  : ''}
                      ${isSelected                  ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface' : ''}
                    `}
                  >
                    <div className="font-mono font-bold text-base text-white">{t.id}</div>
                    <div className="text-zinc-500 text-[9px] truncate">{t.label}</div>
                    <div className="mt-1.5 flex flex-col items-center gap-1">
                      {t.status === 'occupied'     && <span className="text-[8px] font-bold uppercase text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full">Active</span>}
                      {t.status === 'waiting_bill' && <span className="text-[8px] font-bold uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">Bill</span>}
                      {t.status === 'empty'        && <span className="text-[8px] font-bold uppercase text-zinc-700 px-1 py-0.5 rounded-full">Empty</span>}
                      {/* Timer for both occupied and waiting_bill */}
                      {t.occupied_since && t.status !== 'empty' && (
                        <TableTimer since={t.occupied_since} compact />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mobileTab === 'menu' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 pt-2.5 border-b border-surface-border bg-surface-card/50">
              {!selectedTable ? (
                <p className="text-zinc-500 text-xs pb-2.5 text-center">Go to Tables tab to select a table first</p>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white text-sm">{selectedTable.label}</p>
                  {activeOrder && (
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${isDelivered ? 'text-emerald-400 bg-emerald-500/15' : 'text-brand-400 bg-brand-500/15'}`}>
                      {isDelivered ? 'Delivered' : 'Active'}
                    </span>
                  )}
                </div>
              )}
              <CatTabs categories={categories} activeCatId={activeCatId} setActiveCatId={setActiveCatId} />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <MenuGrid filtered={filtered} cart={cart} selectedTable={selectedTable} sym={sym} addToCart={addToCart} cols="grid-cols-2" />
            </div>
          </div>
        )}

        {mobileTab === 'order' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-surface-card">
            <div className="px-4 py-2.5 border-b border-surface-border flex items-center justify-between flex-shrink-0">
              <p className="font-semibold text-sm text-white">{selectedTable ? `Order — ${selectedTable.label}` : 'Order'}</p>
              {activeOrder && selectedTable && (
                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${isDelivered ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' : 'text-brand-400 bg-brand-500/15 border-brand-500/25'}`}>
                  {isDelivered ? 'Delivered' : 'Active'}
                </span>
              )}
            </div>
            {!selectedTable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 px-4">
                <p className="text-xs text-center">Select a table from the Tables tab to begin</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  <OrderContent
                    pastRounds={pastRounds} activeRound={activeRound} allOrders={allOrders}
                    cart={cart} selectedTable={selectedTable} sym={sym}
                    updateQty={updateQty} updateNote={updateNote}
                    onCancelItem={cancelItem} onCancelRound={cancelRound}
                  />
                </div>
                <TotalsBar allOrders={allOrders} cart={cart} sym={sym} cartTotal={cartTotal} grandTotal={grandTotal} />
                <ActionButtons
                  loading={loading} cart={cart} selectedTable={selectedTable}
                  hasBillableOrder={hasBillableOrder} activeRound={activeRound}
                  sendToKitchen={sendToKitchen} onBill={handleBill} clearCart={() => setCart([])}
                />
              </>
            )}
          </div>
        )}
      </div>

      {billModal && hasBillableOrder && billOrderId && selectedTable && (
        <BillModal
          orders={allOrders}
          orderId={billOrderId}
          table={selectedTable}
          onClose={() => setBillModal(false)}
          onClosed={() => {
            setBillModal(false);
            setSelectedTable(null);
            setCart([]);
            setActiveOrder(null);
            setAllOrders([]);
            loadTables();
          }}
        />
      )}
    </div>
  );
}