/**
 * views/WaiterView.tsx
 *
 * Thin shell — state, data fetching, and socket wiring only.
 * UI components live in views/waiter/.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getTables, getMenuItems, getCategories,
  getTableOrders, submitOrder, cancelOrderItem, cancelOrder, directBillOrder,
} from '../services/api';
import { useSocket }   from '../hooks/useSocket';
import { useToast }    from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useTick }     from '../hooks/useTick';
import { playDeliveryChime } from '../utils/sound';
import { reorderLock } from '../utils/reorderLock';

import CatTabs      from './waiter/CatTabs';
import MenuGrid     from './waiter/MenuGrid';
import OrderContent from './waiter/OrderContent';
import TotalsBar    from './waiter/TotalsBar';
import ActionButtons from './waiter/ActionButtons';
import BillModal    from '../components/BillModal';
import TableTimer   from '../components/TableTimer';
import ConfirmModal from '../components/ConfirmModal';

import type { Table, MenuItem, Category, Order } from '../types';

type CartItem  = { menu_item_id: number; name: string; price: number; quantity: number; note: string };
type MobileTab = 'tables' | 'menu' | 'order';

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
      setMenuItems(m);
      setCategories(c);
      setActiveCatId(id => id ?? (c[0]?.id ?? null));
    } catch {}
  }, []);

  const loadTableOrders = useCallback(async (tableId: string) => {
    try {
      const orders    = await getTableOrders(tableId);
      const active    = orders.find(o => o.status === 'active') || null;
      const delivered = orders.filter(o => o.status === 'delivered');
      setAllOrders(orders);
      setActiveOrder(active ?? (delivered.length > 0 ? delivered[delivered.length - 1] : null));
    } catch {
      setAllOrders([]);
      setActiveOrder(null);
    }
  }, []);

  useEffect(() => { loadTables(); loadMenu(); }, []);

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

  const selectTable = async (table: Table) => {
    if (selectedTable?.id === table.id) {
      setMobileTab('menu');
      return;
    }

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
      let activeItems: CartItem[] = [];
      if (activeRound) {
        // Fetch fresh to avoid stale state after cancellations
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

  const handleBill = async () => {
    if (cart.length === 0 && !hasBillableOrder) {
      toast('No order for this table', 'error');
      return;
    }
    if (!selectedTable) return;

    if (cart.length > 0) {
      setLoading(true);
      try {
        if (activeRound) {
          // There's already an active kitchen order — merge cart into it normally
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
          // No active kitchen round — use direct-bill so nothing goes to kitchen,
          // whether this is a fresh table or one that already has delivered rounds.
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

  const allOrdersTotal = allOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0);
  const cartTotal      = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const grandTotal     = allOrdersTotal + cartTotal;
  const hasBillableOrder = allOrders.length > 0 || cart.length > 0;
  const billOrderId      = allOrders.length > 0 ? allOrders[allOrders.length - 1].id : null;
  const filtered         = menuItems.filter(m => m.category_id === activeCatId);
  const pastRounds       = allOrders.filter(o => o.status === 'delivered');
  const activeRound      = allOrders.find(o => o.status === 'active') || null;
  const isDelivered      = !activeRound && pastRounds.length > 0;

  // ── Shared order panel props ───────────────────────────────────────────
  const orderPanelProps = {
    pastRounds, activeRound, allOrders, cart, selectedTable, sym,
    updateQty, updateNote, onCancelItem: cancelItem, onCancelRound: cancelRound,
  };
  const actionProps = {
    loading, cart, selectedTable, hasBillableOrder, activeRound,
    sendToKitchen, onBill: handleBill, clearCart: () => setCart([]),
  };

  // ── Table card renderer (shared between mobile and desktop) ────────────
  const TableButton = ({ table, mobile = false }: { table: Table; mobile?: boolean }) => {
    const isSelected = selectedTable?.id === table.id;
    const baseClass = mobile
      ? `rounded-xl border p-3 text-center transition-all active:scale-95 select-none`
      : `relative rounded-xl border p-2.5 text-left transition-all duration-150 cursor-pointer select-none`;
    const statusClass =
      table.status === 'occupied'     ? 'border-brand-500/60 bg-brand-500/8'    :
      table.status === 'waiting_bill' ? 'border-emerald-500/60 bg-emerald-500/8' :
                                         'border-surface-border hover:border-zinc-600';
    const selectedRing = isSelected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-card' : '';

    return (
      <button
        onClick={() => selectTable(table)}
        className={`${baseClass} ${statusClass} ${selectedRing}`}
      >
        {mobile ? (
          <>
            <div className="font-mono font-bold text-base text-white">{table.id}</div>
            <div className="text-zinc-500 text-[9px] truncate">{table.label}</div>
          </>
        ) : (
          <>
            <div className="font-mono font-bold text-sm text-white leading-none">{table.id}</div>
            <div className="text-zinc-500 text-[9px] mt-0.5 truncate">{table.label}</div>
          </>
        )}
        <div className={`${mobile ? 'mt-1.5 flex flex-col items-center gap-1' : 'mt-1.5 flex flex-col gap-1'}`}>
          {table.status === 'occupied'     && <span className="text-[8px] font-bold uppercase text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full self-start">Active</span>}
          {table.status === 'waiting_bill' && <span className="text-[8px] font-bold uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full self-start">Bill</span>}
          {table.status === 'empty'        && <span className="text-[8px] font-bold uppercase text-zinc-700 px-1 py-0.5 rounded-full self-start">Empty</span>}
          {table.occupied_since && table.status !== 'empty' && (
            <TableTimer since={table.occupied_since} compact />
          )}
        </div>
      </button>
    );
  };

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

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex h-full w-full overflow-hidden">
        {/* Tables sidebar */}
        <aside className="w-40 xl:w-48 flex-shrink-0 flex flex-col border-r border-surface-border bg-surface-card">
          <div className="px-3 py-2.5 border-b border-surface-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tables</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {tables.map(t => <TableButton key={t.id} table={t} />)}
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
              <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                isDelivered
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
                  : 'text-brand-400 bg-brand-500/15 border-brand-500/25'
              }`}>
                {isDelivered ? 'Delivered' : 'Active'}
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
              <p className="text-xs text-center">Select a table from the left to begin</p>
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
        {/* Tab bar */}
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

        {/* Tables tab */}
        {mobileTab === 'tables' && (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-zinc-500 text-xs mb-3 text-center">Tap a table to select it, then go to Menu</p>
            <div className="grid grid-cols-3 gap-2">
              {tables.map(t => <TableButton key={t.id} table={t} mobile />)}
            </div>
          </div>
        )}

        {/* Menu tab */}
        {mobileTab === 'menu' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 pt-2.5 border-b border-surface-border bg-surface-card/50">
              {!selectedTable ? (
                <p className="text-zinc-500 text-xs pb-2.5 text-center">Go to Tables tab to select a table first</p>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white text-sm">{selectedTable.label}</p>
                  {activeOrder && (
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      isDelivered ? 'text-emerald-400 bg-emerald-500/15' : 'text-brand-400 bg-brand-500/15'
                    }`}>
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

        {/* Order tab */}
        {mobileTab === 'order' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-surface-card">
            <div className="px-4 py-2.5 border-b border-surface-border flex items-center justify-between flex-shrink-0">
              <p className="font-semibold text-sm text-white">
                {selectedTable ? `Order — ${selectedTable.label}` : 'Order'}
              </p>
              {activeOrder && selectedTable && (
                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  isDelivered
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
                    : 'text-brand-400 bg-brand-500/15 border-brand-500/25'
                }`}>
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
                  <OrderContent {...orderPanelProps} />
                </div>
                <TotalsBar allOrders={allOrders} cart={cart} sym={sym} cartTotal={cartTotal} grandTotal={grandTotal} />
                <ActionButtons {...actionProps} />
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