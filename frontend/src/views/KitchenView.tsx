import React, { useState, useEffect, useCallback } from 'react';
import { getActiveOrders, deliverOrder } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import { formatElapsed, isUrgent } from '../utils/time';
import { playChime } from '../utils/sound';
import { useTick } from '../hooks/useTick';
import type { Order } from '../types';

export default function KitchenView() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [delivering, setDelivering] = useState<string | null>(null);
  const toast = useToast();
  useTick(15000);

  const load = useCallback(async () => {
    try { setOrders(await getActiveOrders()); }
    catch { toast('Failed to load orders', 'error'); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, []);

  useSocket('new_order',       ({ order }: { order: Order }) => { playChime(); setOrders(prev => prev.some(o=>o.id===order.id) ? prev : [...prev, order]); });
  useSocket('order_updated',   ({ order }: { order: Order }) => { setOrders(prev => prev.some(o=>o.id===order.id) ? prev.map(o=>o.id===order.id?order:o) : prev); });
  useSocket('order_delivered', ({ order }: { order: Order }) => { setOrders(prev => prev.filter(o=>o.id!==order.id)); });
  useSocket('order_closed',    ({ orderId }: { orderId: string }) => { setOrders(prev => prev.filter(o=>o.id!==orderId)); });

  const handleDeliver = async (orderId: string) => {
    setDelivering(orderId);
    try { await deliverOrder(orderId); setOrders(prev=>prev.filter(o=>o.id!==orderId)); toast('Order delivered','success'); }
    catch { toast('Failed','error'); }
    finally { setDelivering(null); }
  };

  const urgentCount = orders.filter(o => isUrgent(o.created_at, 20)).length;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* FIX #8: Header with properly spaced badges that don't overflow on mobile */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-surface-border bg-surface-card/50 flex-wrap">
        <h2 className="font-bold text-white text-sm whitespace-nowrap">Kitchen Display</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {orders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-400 bg-brand-500/15 border border-brand-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block" />
              {orders.length} Active
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
        {orders.length === 0 ? (
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
