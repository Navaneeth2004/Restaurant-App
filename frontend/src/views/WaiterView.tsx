/**
 * views/WaiterView.tsx
 *
 * CHANGES (parcel support):
 * 1. "New Parcel" button in the table list sidebar/header.
 * 2. Parcel slots (id starts with "P") render with a distinct indigo style
 *    and a "Parcel" badge so they're visually separate from dine-in tables.
 * 3. ParcelModal wired up — creates the slot and refreshes the table list.
 * 4. When a parcel slot is selected, BillModal pre-sets order_type = 'parcel'.
 * 5. Parcel slots can be removed from the table list after billing via a
 *    small hover "×" button that calls DELETE /api/parcel/slot/:id.
 * 6. bill_requested socket handler retained from kiosk fix.
 *
 * Everything else (add items, send to kitchen, cancel item, cancel round,
 * generate bill) works identically for parcel slots as for dine-in tables
 * because they ARE tables in the DB.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getTables, getMenuItems, getCategories,
  getTableOrders, submitOrder, cancelOrderItem, cancelOrder, directBillOrder,
} from '../services/api';
import { useSocket }    from '../hooks/useSocket';
import { useToast }     from '../context/ToastContext';
import { useSettings }  from '../context/SettingsContext';
import { useTick }      from '../hooks/useTick';
import { playDeliveryChime } from '../utils/sound';
import { reorderLock }  from '../utils/reorderLock';
import { authedFetch }  from '../utils/authedFetch';

import CatTabs       from './waiter/CatTabs';
import MenuGrid      from './waiter/MenuGrid';
import OrderContent  from './waiter/OrderContent';
import TotalsBar     from './waiter/TotalsBar';
import ActionButtons from './waiter/ActionButtons';
import ParcelModal   from './waiter/ParcelModal';
import QRModal       from '../components/admin/QRModal';
import BillModal     from '../components/BillModal';
import TableTimer    from '../components/TableTimer';
import ConfirmModal  from '../components/ConfirmModal';

import type { Table, MenuItem, Category, Order } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

type CartItem  = { menu_item_id: number; name: string; price: number; quantity: number; note: string };
type MobileTab = 'tables' | 'menu' | 'order';

/** Distinct chime for bill requests from the kiosk */
function playBillRequestChime(): void {
  try {
    const ctx   = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [
      { freq: 1046.5, start: 0,    dur: 0.3,  peak: 0.2  },
      { freq: 1046.5, start: 0.22, dur: 0.3,  peak: 0.2  },
      { freq: 1318.5, start: 0.44, dur: 0.45, peak: 0.18 },
    ];
    notes.forEach(({ freq, start, dur, peak }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  } catch { /* silent fail */ }
}

/** Returns true if this table id is a parcel slot */
function isParcel(tableId: string): boolean {
  return /^P\d+$/.test(tableId);
}

/** Remove a parcel slot after it has been fully closed/paid */
async function removeParcelSlot(id: string): Promise<void> {
  const res = await authedFetch(`${API_BASE}/api/parcel/slot/${id}`, { method: 'DELETE' });
  const d   = await res.json();
  if (!res.ok) throw new Error(d.error || 'Failed to remove parcel slot');
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
  const [parcelModal,   setParcelModal]   = useState(false);
  // Track which parcel slot to show QR for (re-open anytime from its card)
  const [parcelQrSlot,  setParcelQrSlot]  = useState<Table | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [mobileTab,     setMobileTab]     = useState<MobileTab>('tables');
  const [confirmModal,  setConfirmModal]  = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  const toast    = useToast();
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  useTick(30000);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadTables = useCallback(async () => {
    try { setTables(await getTables()); } catch {}
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([getMenuItems(), getCategories()]);
      setMenuItems(m);
      setCategories(c);
      setActiveCatId(id => id ?? (c[0]?.id ?? null));
    } catch {}
  }, []);

  const loadTableOrders = useCallback(async (tableId: string) => {
    try {
      const orders = await getTableOrders(tableId);
      const active = orders.find(o => o.status === 'active') || null;
      setAllOrders(orders);
      setActiveOrder(active);
    } catch {
      setAllOrders([]);
      setActiveOrder(null);
    }
  }, []);

  useEffect(() => { loadTables(); loadMenu(); }, []);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useSocket('tables_updated', loadTables);
  useSocket('menu_updated', () => { if (!reorderLock.isLocked()) loadMenu(); });
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
  useSocket('bill_requested', ({ tableId, tableLabel }: { tableId: string; tableLabel: string }) => {
    playBillRequestChime();
    toast(`🧾 Bill requested — ${tableLabel}`, 'info');
    loadTables();
  });

  // ── Table / parcel selection ──────────────────────────────────────────────
  const selectTable = async (table: Table) => {
    if (selectedTable?.id === table.id) { setMobileTab('menu'); return; }
    setSelectedTable(table);
    setCart([]);
    setActiveOrder(null);
    setAllOrders([]);
    setMobileTab('menu');
    await loadTableOrders(table.id);
  };

  // ── Remove a parcel slot ──────────────────────────────────────────────────
  const handleRemoveParcel = (table: Table) => {
    setConfirmModal({
      title:        'Remove Parcel Slot',
      message:      `Remove "${table.label}"? Only works after the order is billed and closed.`,
      confirmLabel: 'Remove',
      danger:       true,
      onConfirm:    async () => {
        setConfirmModal(null);
        try {
          await removeParcelSlot(table.id);
          toast(`${table.label} removed`, 'success');
          if (selectedTable?.id === table.id) {
            setSelectedTable(null); setCart([]); setActiveOrder(null); setAllOrders([]);
          }
          loadTables();
        } catch (e: any) {
          toast(e.message || 'Cannot remove — close the order first', 'error');
        }
      },
    });
  };

  // ── Cart actions ──────────────────────────────────────────────────────────
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

  // ── Send to kitchen ───────────────────────────────────────────────────────
  const sendToKitchen = async () => {
    if (!selectedTable || !cart.length) { toast('Add items first', 'error'); return; }
    setLoading(true);
    try {
      let activeItems: CartItem[] = [];
      if (activeRound) {
        const freshOrders = await getTableOrders(selectedTable.id);
        const freshActive = freshOrders.find(o => o.status === 'active');
        if (freshActive) {
          activeItems = freshActive.items.map(i => ({
            menu_item_id: i.menu_item_id,
            name: i.name, price: i.price, quantity: i.quantity, note: i.note || '',
          }));
        }
      }
      await submitOrder({ table_id: selectedTable.id, items: [...activeItems, ...cart] });
      setCart([]);
      toast(`Order sent for ${selectedTable.label}`, 'success');
      setMobileTab('order');
      await loadTableOrders(selectedTable.id);
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel item / round ───────────────────────────────────────────────────
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

  const cancelRound = (orderId: string) => {
    setConfirmModal({
      title: 'Cancel Entire Round',
      message: 'All items in this round will be cancelled. The kitchen will be notified.',
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

  // ── Generate bill ─────────────────────────────────────────────────────────
  const handleBill = async () => {
    if (!selectedTable) return;
    if (cart.length === 0 && allOrders.length === 0) {
      toast('No order for this slot', 'error');
      return;
    }
    if (cart.length > 0) {
      setLoading(true);
      try {
        if (activeRound) {
          const freshOrders = await getTableOrders(selectedTable.id);
          const freshActive = freshOrders.find(o => o.status === 'active');
          const activeItems: CartItem[] = freshActive
            ? freshActive.items.map(i => ({
                menu_item_id: i.menu_item_id,
                name: i.name, price: i.price, quantity: i.quantity, note: i.note || '',
              }))
            : [];
          await submitOrder({ table_id: selectedTable.id, items: [...activeItems, ...cart] });
          setCart([]);
          await loadTableOrders(selectedTable.id);
        } else {
          await directBillOrder({ table_id: selectedTable.id, items: cart });
          setCart([]);
          await loadTableOrders(selectedTable.id);
        }
      } catch (e: any) {
        toast(e.response?.data?.error || 'Failed to prepare bill', 'error');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setBillModal(true);
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const allOrdersTotal   = allOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0);
  const cartTotal        = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const grandTotal       = allOrdersTotal + cartTotal;
  const hasBillableOrder = allOrders.length > 0 || cart.length > 0;
  const billOrderId      = allOrders.length > 0 ? allOrders[allOrders.length - 1].id : null;
  const filtered         = menuItems.filter(m => m.category_id === activeCatId);
  const pastRounds       = allOrders.filter(o => o.status === 'delivered');
  const activeRound      = allOrders.find(o => o.status === 'active') || null;
  const isDelivered      = !activeRound && pastRounds.length > 0;
  const selectedIsParcel = selectedTable ? isParcel(selectedTable.id) : false;

  const dineInTables = tables.filter(t => !isParcel(t.id));
  const parcelSlots  = tables.filter(t => isParcel(t.id));

  // ── Shared panel props ────────────────────────────────────────────────────
  const orderPanelProps = {
    pastRounds, activeRound, allOrders, cart, selectedTable, sym,
    updateQty, updateNote, onCancelItem: cancelItem, onCancelRound: cancelRound,
  };
  const actionProps = {
    loading, cart, selectedTable, hasBillableOrder, activeRound,
    sendToKitchen, onBill: handleBill, clearCart: () => setCart([]),
  };

  const orderPanelLabel = selectedTable
    ? selectedIsParcel ? selectedTable.label : `Order — ${selectedTable.label}`
    : 'Order';

  // ── Table card ────────────────────────────────────────────────────────────
  // FIX: All cards use the same fixed height (minHeight) so empty/occupied/
  // parcel-with-timer / parcel-without-timer are all the same size in the grid.
  // FIX: Empty dine-in tables now have a proper pill (same colour, bg-transparent
  // border so it's a ghost pill — visible but not dominant).
  // FIX: Button order changed — Remove (trash) on LEFT, QR on RIGHT.
  const TableButton = ({ table, mobile = false }: { table: Table; mobile?: boolean }) => {
    const isSelected = selectedTable?.id === table.id;
    const parcel     = isParcel(table.id);

    const statusClass = parcel
      ? table.status === 'waiting_bill'
        ? 'border-emerald-500/60 bg-emerald-500/8'
        : table.status === 'occupied'
          ? 'border-indigo-500/60 bg-indigo-500/8'
          : 'border-indigo-500/30 bg-indigo-500/5'
      : table.status === 'occupied'     ? 'border-brand-500/60 bg-brand-500/8'
      : table.status === 'waiting_bill' ? 'border-emerald-500/60 bg-emerald-500/8'
      : 'border-surface-border hover:border-zinc-600';

    const selectedRing = isSelected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-card' : '';

    const dotColor = parcel
      ? table.status === 'waiting_bill' ? 'bg-emerald-400'
        : table.status === 'occupied'  ? 'bg-indigo-400' : 'bg-indigo-800'
      : table.status === 'occupied'     ? 'bg-brand-400'
      : table.status === 'waiting_bill' ? 'bg-emerald-400' : 'bg-zinc-800';

    // FIX: Every status — including empty — has a styled badge so all
    // cards have the same bottom-row content structure → uniform height.
    const badge = parcel
      ? table.status === 'waiting_bill'
        ? { text: 'Bill',   cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' }
        : { text: 'Parcel', cls: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25' }
      : table.status === 'occupied'
        ? { text: 'Active', cls: 'text-brand-400 bg-brand-500/15 border-brand-500/25' }
        : table.status === 'waiting_bill'
          ? { text: 'Bill',  cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' }
          : { text: 'Empty', cls: 'text-zinc-700 bg-transparent border-zinc-700/40' };

    // Parcel hover buttons — FIX order: Remove (×) on LEFT, QR icon on RIGHT
    const ParcelButtons = ({ size }: { size: 'sm'|'xs' }) => {
      const sz  = size === 'sm' ? 'w-6 h-6 rounded-lg' : 'w-5 h-5 rounded';
      const ico = size === 'sm' ? 'w-3.5 h-3.5'        : 'w-3 h-3';
      return (
        <div className={`absolute top-1.5 right-1.5 flex flex-row gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
          {/* LEFT: Remove (×) */}
          <button
            onClick={e => { e.stopPropagation(); handleRemoveParcel(table); }}
            title="Remove parcel slot"
            className={`${sz} flex items-center justify-center text-zinc-600 bg-surface-card/80 hover:text-red-400 hover:bg-red-500/10 transition-colors`}
          >
            <svg className={ico} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* RIGHT: QR icon */}
          <button
            onClick={e => { e.stopPropagation(); setParcelQrSlot(table); }}
            title="Show QR code"
            className={`${sz} flex items-center justify-center text-zinc-600 bg-surface-card/80 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors`}
          >
            <svg className={ico} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            </svg>
          </button>
        </div>
      );
    };

    if (mobile) {
      return (
        <div className="relative group">
          <button
            onClick={() => selectTable(table)}
            className={`w-full rounded-2xl border p-4 text-left transition-all active:scale-95 select-none flex flex-col ${statusClass} ${selectedRing}`}
            style={{ minHeight: 108 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`font-mono font-bold text-2xl leading-none ${parcel ? 'text-indigo-300' : 'text-white'}`}>{table.id}</div>
                <div className="text-zinc-400 text-xs mt-1.5 truncate leading-snug">{table.label}</div>
              </div>
              <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1 ${dotColor}`} />
            </div>
            {/* Bottom row — badge always present, timer only when occupied */}
            <div className="mt-auto pt-3 flex items-center justify-between gap-2">
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
              {table.occupied_since && table.status !== 'empty' && (
                <TableTimer since={table.occupied_since} compact />
              )}
            </div>
          </button>
          {parcel && <ParcelButtons size="sm" />}
        </div>
      );
    }

    // Desktop sidebar card
    return (
      <div className="relative group">
        <button
          onClick={() => selectTable(table)}
          className={`w-full rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer select-none flex flex-col ${statusClass} ${selectedRing}`}
          style={{ minHeight: 96 }}
        >
          <div className={`font-mono font-bold text-base leading-none ${parcel ? 'text-indigo-300' : 'text-white'}`}>{table.id}</div>
          <div className="text-zinc-500 text-[10px] mt-1 truncate leading-snug">{table.label}</div>
          {/* Bottom area — badge always present, timer stacked below when occupied */}
          <div className="mt-auto flex flex-col gap-1 items-start">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
            {table.occupied_since && table.status !== 'empty' && (
              <TableTimer since={table.occupied_since} compact />
            )}
          </div>
        </button>
        {parcel && <ParcelButtons size="xs" />}
      </div>
    );
  };

  // ── Shared table list — REDESIGNED section spacing ──────────────────────
  const TableList = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col gap-3">
      <div className={mobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-2'}>
        {dineInTables.map(t => <TableButton key={t.id} table={t} mobile={mobile} />)}
      </div>

      {parcelSlots.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400/70 flex-shrink-0">
              Parcel / Takeaway
            </p>
            <div className="h-px flex-1 bg-indigo-500/15" />
          </div>
          <div className={mobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-2'}>
            {parcelSlots.map(t => <TableButton key={t.id} table={t} mobile={mobile} />)}
          </div>
        </div>
      )}

      <button
        onClick={() => setParcelModal(true)}
        className={`w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-500/25 hover:border-indigo-500/50 text-indigo-400/60 hover:text-indigo-400 font-semibold transition-all ${
          mobile ? 'py-3 text-xs' : 'py-2 text-[11px]'
        }`}
      >
        <svg className={mobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New Parcel
      </button>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
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

      {parcelModal && (
        <ParcelModal
          onCreated={() => loadTables()}
          onClose={() => setParcelModal(false)}
        />
      )}

      {/* FIX: re-open QR for any parcel slot at any time */}
      {parcelQrSlot && (
        <QRModal
          table={parcelQrSlot}
          onClose={() => setParcelQrSlot(null)}
        />
      )}

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex h-full w-full overflow-hidden">
        <aside className="w-44 xl:w-52 flex-shrink-0 flex flex-col border-r border-surface-border bg-surface-card">
          <div className="px-3 py-2.5 border-b border-surface-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tables</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <TableList />
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 pt-3 pb-0 border-b border-surface-border bg-surface-card/50">
            <div className="mb-2 flex items-center gap-2">
              {selectedTable ? (
                <>
                  <span className="font-semibold text-white text-sm">{selectedTable.label}</span>
                  {selectedIsParcel && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                      Parcel
                    </span>
                  )}
                </>
              ) : (
                <span className="text-zinc-500 text-sm">Select a table or parcel slot</span>
              )}
            </div>
            <CatTabs categories={categories} activeCatId={activeCatId} setActiveCatId={setActiveCatId} />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MenuGrid filtered={filtered} cart={cart} selectedTable={selectedTable} sym={sym} addToCart={addToCart} />
          </div>
        </div>

        <aside className="w-64 xl:w-72 flex-shrink-0 border-l border-surface-border bg-surface-card flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between flex-shrink-0">
            <p className="font-semibold text-sm text-white truncate">{orderPanelLabel}</p>
            {activeOrder && selectedTable && (
              <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${
                isDelivered
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
                  : 'text-brand-400 bg-brand-500/15 border-brand-500/25'
              }`}>
                {isDelivered ? 'Ready' : 'Active'}
              </span>
            )}
          </div>
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 px-4">
              <div className="w-10 h-10 rounded-xl border border-surface-border flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-1.684 2.032-3.501 2.032-5.25a6 6 0 00-6-6 6 6 0 00-6 6c0 1.749.911 3.566 2.032 5.25z" />
                </svg>
              </div>
              <p className="text-xs text-center">Select a table or create a parcel slot</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <OrderContent {...orderPanelProps} />
              </div>
              <TotalsBar allOrders={allOrders} cart={cart} sym={sym} cartTotal={cartTotal} grandTotal={grandTotal} />
              <ActionButtons {...actionProps} />
            </>
          )}
        </aside>
      </div>

      {/* ── MOBILE ── */}
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
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 relative ${
                mobileTab === tab.key ? 'text-brand-400 border-brand-500' : 'text-zinc-500 border-transparent'
              }`}
            >
              {tab.label}
              {tab.key === 'order' && cart.length > 0 && (
                <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {mobileTab === 'tables' && (
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-zinc-500 text-xs mb-3">Tap to select, then go to Menu</p>
            <TableList mobile />
          </div>
        )}

        {mobileTab === 'menu' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 pt-2.5 border-b border-surface-border bg-surface-card/50">
              {!selectedTable ? (
                <p className="text-zinc-500 text-xs pb-2.5 text-center">Select a table or parcel slot first</p>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-white text-sm">{selectedTable.label}</p>
                  {selectedIsParcel && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                      Parcel
                    </span>
                  )}
                  {activeOrder && (
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ml-auto ${
                      isDelivered ? 'text-emerald-400 bg-emerald-500/15' : 'text-brand-400 bg-brand-500/15'
                    }`}>
                      {isDelivered ? 'Ready' : 'Active'}
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
              <p className="font-semibold text-sm text-white truncate">{orderPanelLabel}</p>
              {activeOrder && selectedTable && (
                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  isDelivered
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
                    : 'text-brand-400 bg-brand-500/15 border-brand-500/25'
                }`}>
                  {isDelivered ? 'Ready' : 'Active'}
                </span>
              )}
            </div>
            {!selectedTable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 px-4">
                <p className="text-xs text-center">Select a table or parcel slot from the Tables tab</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  <OrderContent {...orderPanelProps} />
                </div>
                <TotalsBar allOrders={allOrders} cart={cart} sym={sym} cartTotal={cartTotal} grandTotal={grandTotal} />
                <ActionButtons {...actionProps} />
              </>
            )}
          </div>
        )}
      </div>

      {billModal && selectedTable && (
        <BillModal
          orders={allOrders}
          orderId={billOrderId || 'cart-only'}
          table={selectedTable}
          defaultOrderType={selectedIsParcel ? 'parcel' : 'dine_in'}
          onClose={() => setBillModal(false)}
          onClosed={async () => {
            setBillModal(false);
            // FIX: auto-remove parcel slot after billing — no manual step needed
            if (selectedIsParcel && selectedTable) {
              try { await removeParcelSlot(selectedTable.id); } catch { /* ignore */ }
            }
            setSelectedTable(null);
            setCart([]);
            setActiveOrder(null);
            setAllOrders([]);
            loadTables();
          }}
          cartItems={[]}
        />
      )}
    </div>
  );
}