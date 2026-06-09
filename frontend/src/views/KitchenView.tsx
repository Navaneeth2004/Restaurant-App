import React, { useState, useEffect, useCallback } from 'react';
import { getActiveOrders, deliverOrder } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import { formatElapsed, isUrgent } from '../utils/time';
import { playChime } from '../utils/sound';
import { useTick } from '../hooks/useTick';
import type { Order, OrderItem } from '../types';

interface Addition {
  id: string;
  orderId: string;
  tableId: string;
  additions: OrderItem[];
  createdAt: string;
}

interface Cancellation {
  id: string;
  orderId: string;
  tableId: string;
  type: 'item' | 'round';
  cancelledItem?: OrderItem;
  cancelledItems?: OrderItem[];
  createdAt: string;
}

function playCancelChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 415.30, 349.23];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch { /* silent fail */ }
}

export default function KitchenView() {
  const [orders,        setOrders]        = useState<Order[]>([]);
  const [additions,     setAdditions]     = useState<Addition[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [delivering,    setDelivering]    = useState<string | null>(null);
  const toast = useToast();
  useTick(15000);

  const load = useCallback(async () => {
    try { setOrders(await getActiveOrders()); }
    catch { toast('Failed to load orders', 'error'); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, []);

  useSocket('new_order', ({ order }: { order: Order }) => {
    playChime();
    setOrders(prev => prev.some(o => o.id === order.id) ? prev : [...prev, order]);
  });

  useSocket('order_updated', ({ order }: { order: Order }) => {
    setOrders(prev =>
      prev.some(o => o.id === order.id)
        ? prev.map(o => o.id === order.id ? order : o)
        : prev
    );
  });

  useSocket('order_additions', (data: { orderId: string; tableId: string; additions: OrderItem[]; createdAt: string }) => {
    playChime();
    const addition: Addition = { id: `${data.orderId}-${Date.now()}`, ...data };
    setAdditions(prev => [...prev, addition]);
    setTimeout(() => setAdditions(prev => prev.filter(a => a.id !== addition.id)), 5 * 60 * 1000);
  });

  // Item cancelled from active/delivered order
  useSocket('order_item_cancelled', (data: { orderId: string; tableId: string; cancelledItem: OrderItem; orderStatus: string; updatedOrder: Order }) => {
    playCancelChime();
    // Update order in list if active
    setOrders(prev => prev.map(o => o.id === data.orderId ? data.updatedOrder : o));
    const cancellation: Cancellation = {
      id: `cancel-item-${data.orderId}-${Date.now()}`,
      orderId: data.orderId,
      tableId: data.tableId,
      type: 'item',
      cancelledItem: data.cancelledItem,
      createdAt: new Date().toISOString(),
    };
    setCancellations(prev => [...prev, cancellation]);
    setTimeout(() => setCancellations(prev => prev.filter(c => c.id !== cancellation.id)), 5 * 60 * 1000);
  });

  // Entire round cancelled
  useSocket('order_round_cancelled', (data: { orderId: string; tableId: string; cancelledItems: OrderItem[]; orderStatus: string }) => {
    playCancelChime();
    setOrders(prev => prev.filter(o => o.id !== data.orderId));
    setAdditions(prev => prev.filter(a => a.orderId !== data.orderId));
    const cancellation: Cancellation = {
      id: `cancel-round-${data.orderId}-${Date.now()}`,
      orderId: data.orderId,
      tableId: data.tableId,
      type: 'round',
      cancelledItems: data.cancelledItems,
      createdAt: new Date().toISOString(),
    };
    setCancellations(prev => [...prev, cancellation]);
    setTimeout(() => setCancellations(prev => prev.filter(c => c.id !== cancellation.id)), 5 * 60 * 1000);
  });

  useSocket('order_delivered', ({ order }: { order: Order }) => {
    setOrders(prev => prev.filter(o => o.id !== order.id));
    setAdditions(prev => prev.filter(a => a.orderId !== order.id));
  });

  useSocket('order_closed', ({ orderId }: { orderId: string }) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setAdditions(prev => prev.filter(a => a.orderId !== orderId));
    setCancellations(prev => prev.filter(c => c.orderId !== orderId));
  });

  const handleDeliver = async (orderId: string) => {
    setDelivering(orderId);
    try {
      await deliverOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setAdditions(prev => prev.filter(a => a.orderId !== orderId));
      toast('Order delivered', 'success');
    } catch { toast('Failed', 'error'); }
    finally { setDelivering(null); }
  };

  const dismissAddition    = (id: string) => setAdditions(prev => prev.filter(a => a.id !== id));
  const dismissCancellation = (id: string) => setCancellations(prev => prev.filter(c => c.id !== id));

  const urgentCount = orders.filter(o => isUrgent(o.created_at, 20)).length;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-surface-border bg-surface-card/50 flex-wrap">
        <h2 className="font-bold text-white text-sm whitespace-nowrap">Kitchen Display</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {orders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-400 bg-brand-500/15 border border-brand-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block" />
              {orders.length} Active
            </span>
          )}
          {additions.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
              {additions.length} Addition{additions.length > 1 ? 's' : ''}
            </span>
          )}
          {cancellations.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/15 border border-red-500/25 px-2.5 py-1 rounded-full whitespace-nowrap animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              {cancellations.length} Cancellation{cancellations.length > 1 ? 's' : ''}
            </span>
          )}
          {urgentCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/15 border border-red-500/25 px-2.5 py-1 rounded-full whitespace-nowrap animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              {urgentCount} Overdue
            </span>
          )}
        </div>
        <div className="ml-auto text-zinc-600 text-xs font-mono whitespace-nowrap">{now}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 && additions.length === 0 && cancellations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="font-bold text-white text-lg">All caught up</p>
            <p className="text-zinc-500 text-sm mt-1">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {/* Cancellation cards — shown FIRST, most urgent */}
            {cancellations.map(c => (
              <div key={c.id} className="rounded-xl border border-red-500/70 overflow-hidden flex flex-col animate-slide-up shadow-lg shadow-red-500/15">
                <div className="px-4 py-3 flex items-center justify-between bg-red-600">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white text-2xl leading-none">{c.tableId}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-red-100 bg-red-700/50 px-1.5 py-0.5 rounded">
                      {c.type === 'round' ? 'Round Cancelled' : 'Item Removed'}
                    </span>
                  </div>
                  <button
                    onClick={() => dismissCancellation(c.id)}
                    className="w-6 h-6 rounded-full bg-red-700/40 hover:bg-red-700/70 flex items-center justify-center text-red-100 transition-colors"
                    title="Dismiss"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="px-4 py-3 flex-1 space-y-2.5 bg-surface-card">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/80 mb-1">
                    {c.type === 'round' ? 'Stop making — entire round cancelled' : 'Stop making — this item was removed'}
                  </p>
                  {c.type === 'item' && c.cancelledItem && (
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono font-bold text-red-400 text-lg leading-none w-8 flex-shrink-0 line-through">{c.cancelledItem.quantity}×</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold leading-snug line-through opacity-75">{c.cancelledItem.name}</p>
                        {c.cancelledItem.note && (
                          <p className="text-red-400/60 text-xs mt-0.5">{c.cancelledItem.note}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {c.type === 'round' && c.cancelledItems && c.cancelledItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="font-mono font-bold text-red-400 text-lg leading-none w-8 flex-shrink-0 line-through">{item.quantity}×</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold leading-snug line-through opacity-75">{item.name}</p>
                        {item.note && <p className="text-red-400/60 text-xs mt-0.5">{item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-surface-border">
                  <button onClick={() => dismissCancellation(c.id)}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Understood
                  </button>
                </div>
              </div>
            ))}

            {/* Addition cards */}
            {additions.map(addition => (
              <div key={addition.id} className="rounded-xl border border-amber-500/60 overflow-hidden flex flex-col animate-slide-up shadow-lg shadow-amber-500/10">
                <div className="px-4 py-3 flex items-center justify-between bg-amber-500">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white text-2xl leading-none">{addition.tableId}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-100 bg-amber-600/40 px-1.5 py-0.5 rounded">+ Added Items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-600/60 text-amber-100 whitespace-nowrap">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {formatElapsed(addition.createdAt)}
                    </div>
                    <button
                      onClick={() => dismissAddition(addition.id)}
                      className="w-6 h-6 rounded-full bg-amber-600/40 hover:bg-amber-600/70 flex items-center justify-center text-amber-100 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 flex-1 space-y-2.5 bg-surface-card">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80 mb-1">New items only — existing order still in progress</p>
                  {addition.additions.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="font-mono font-bold text-amber-400 text-lg leading-none w-8 flex-shrink-0">{item.quantity}×</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold leading-snug">{item.name}</p>
                        {item.note && (
                          <p className="text-amber-400/80 text-xs mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                            {item.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-surface-border">
                  <button onClick={() => dismissAddition(addition.id)}
                    className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Got it — making these now
                  </button>
                </div>
              </div>
            ))}

            {/* Regular order cards */}
            {orders.map(order => {
              const urgent  = isUrgent(order.created_at, 20);
              const elapsed = formatElapsed(order.created_at);
              return (
                <div key={order.id} className={`rounded-xl border overflow-hidden flex flex-col animate-slide-up ${urgent ? 'border-red-500/60 shadow-lg shadow-red-500/10' : 'border-surface-border'}`}>
                  <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-red-500' : 'bg-brand-500'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-white text-2xl leading-none">{order.table_id}</span>
                      {urgent && <span className="text-[9px] font-bold uppercase tracking-widest text-red-100 bg-red-600/40 px-1.5 py-0.5 rounded">Overdue</span>}
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${urgent ? 'bg-red-600/60 text-red-100' : 'bg-brand-600/60 text-brand-100'}`}>
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {elapsed}
                    </div>
                  </div>
                  <div className="px-4 py-3 flex-1 space-y-2.5 bg-surface-card">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="font-mono font-bold text-brand-400 text-lg leading-none w-8 flex-shrink-0">{item.quantity}×</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold leading-snug">{item.name}</p>
                          {item.note && (
                            <p className="text-amber-400/80 text-xs mt-0.5 flex items-center gap-1">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                              {item.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-surface-border">
                    <button onClick={() => handleDeliver(order.id)} disabled={delivering === order.id}
                      className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                      {delivering === order.id
                        ? <><div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" /> Updating…</>
                        : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Mark Delivered</>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}