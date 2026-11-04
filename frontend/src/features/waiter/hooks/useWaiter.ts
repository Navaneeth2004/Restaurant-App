import { useCallback, useMemo, useState } from 'react';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useNow } from 'hooks/time/useNow';
import { isParcelTable } from 'lib/input/ids';
import { sumLines } from 'lib/format/money';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';
import { ordersSubtotal, splitRounds } from './rounds';
import { useCarts } from './useCarts';
import { useMenu } from './live/useMenu';
import { useOrderActions } from './useOrderActions';
import { useRemoveParcel } from './live/useParcelSlots';
import { useTableOrders } from 'hooks/async/useTableOrders';
import { useTables } from './live/useTables';
import { useWaiterEvents } from './live/useWaiterEvents';

export type MobileTab = 'tables' | 'menu' | 'order';

/** Everything the waiter screen needs. Layout components only render this. */
export function useWaiter() {
  const nowMs = useNow(30_000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tab, setTab] = useState<MobileTab>('tables');
  const [parcelOpen, setParcelOpen] = useState(false);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [billOrders, setBillOrders] = useState<Order[] | null>(null);

  const tablesState = useTables();
  const menu = useMenu();
  const table = useMemo(() => tablesState.tables.find(t => t.id === selectedId) ?? null, [tablesState.tables, selectedId]);
  const ordersState = useTableOrders(table?.id ?? null);
  const carts = useCarts(table?.id ?? null);
  const confirm = useConfirmAction();
  const removeParcel = useRemoveParcel();

  const { reload: reloadTables } = tablesState;
  const { reload: reloadOrders } = ordersState;
  const { reload: reloadMenu } = menu;
  const refresh = useCallback(() => { reloadOrders(); reloadTables(); }, [reloadOrders, reloadTables]);
  const reloadAll = useCallback(() => { refresh(); reloadMenu(); }, [refresh, reloadMenu]);

  const rounds = useMemo(() => splitRounds(ordersState.orders), [ordersState.orders]);
  const actions = useOrderActions({
    table, cart: carts.cart, hasActiveRound: rounds.active !== null, clearCart: carts.clear,
    refresh, ask: confirm.ask, onSent: useCallback(() => setTab('order'), []),
  });
  const { clearTable } = carts;
  useWaiterEvents({
    selectedId, tables: tablesState.tables, reloadTables, reloadOrders, reloadAll,
    onSelectedClosed: useCallback((id: string) => { clearTable(id); setSelectedId(null); }, [clearTable]),
  });

  const select = useCallback((t: Table) => { setSelectedId(t.id); setTab('menu'); }, []);
  const activeCategory = categoryId ?? menu.categories[0]?.id ?? null;
  const openBill = useCallback(async () => {
    const fresh = await actions.prepareBill();
    if (fresh) setBillOrders(fresh);
  }, [actions]);

  const onBillClosed = useCallback(async () => {
    const closed = table;
    setBillOrders(null);
    if (!closed) return;
    carts.clearTable(closed.id);
    setSelectedId(null);
    if (isParcelTable(closed)) await removeParcel(closed.id, closed.label);
    reloadTables();
  }, [table, carts, removeParcel, reloadTables]);

  const askRemoveParcel = useCallback((t: Table) => confirm.ask({
    title: 'Remove Parcel Slot', message: `Remove "${t.label}"? Only works after the order is billed and closed.`,
    confirmLabel: 'Remove', danger: true,
    action: async () => {
      if (await removeParcel(t.id, t.label)) { if (selectedId === t.id) setSelectedId(null); reloadTables(); }
    },
  }), [confirm, removeParcel, selectedId, reloadTables]);

  const cartTotal = sumLines(carts.cart);
  return {
    nowMs, tables: tablesState, menu, table, orders: ordersState, rounds, carts, actions, confirm,
    tab, setTab, select, categoryId: activeCategory, setCategoryId,
    parcelOpen, setParcelOpen, qrTable, setQrTable, askRemoveParcel,
    billOrders, setBillOrders, openBill, onBillClosed,
    cartTotal, grandTotal: sumLines([{ price: ordersSubtotal(ordersState.orders), quantity: 1 }, { price: cartTotal, quantity: 1 }]),
    refresh,
  };
}

export type WaiterState = ReturnType<typeof useWaiter>;
