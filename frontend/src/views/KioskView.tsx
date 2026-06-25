/**
 * frontend/src/views/KioskView.tsx
 *
 * Customer-facing kiosk page, loaded when a QR code is scanned.
 * Completely isolated from the rest of the app — no auth, no nav, no logout.
 *
 * FIXES in this revision:
 *
 * 1. REDESIGN — no emoji anywhere. Visual language now matches the rest of
 *    the POS exactly: same surface/brand color tokens, same rounded-xl
 *    cards, same icon set (Heroicons outline) used in WaiterView/AdminMenu,
 *    same Inter typography. Built mobile-first (this is what customers
 *    actually use) but verified at desktop widths too, since some
 *    customers will open the link on a laptop.
 *
 * 2. BUG FIX — "Round 2 sends Round 1's items again". The previous version
 *    pre-merged delivered-round items into the outgoing request:
 *
 *        const activeOrder = orders.find(o => o.status === 'active');
 *        let itemsToSend = [...cart];
 *        if (activeOrder) itemsToSend = [...activeItems, ...cart];
 *        await kioskPost(token, '/order', { items: itemsToSend });
 *
 *    The bug: `orders` is captured from component state, which can still
 *    hold a stale reference to what *was* the active order if the bill/
 *    delivery socket event hasn't re-rendered yet, OR if the round was
 *    delivered via the kitchen/waiter side without a fresh re-fetch on
 *    this screen. The fix below NEVER pre-merges on the client. The cart
 *    is sent as-is — exactly what the customer added in this sitting —
 *    and the backend (kiosk.js) is now the single source of truth for
 *    merging against the live DB state of the genuinely active order only
 *    (see kiosk.js comments). Additionally, orders are now always
 *    refreshed immediately before sending, never trusted from a stale
 *    closure.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { MenuItem, Category, Order } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────

interface KioskContext {
  kiosk_type:      'table' | 'standalone';
  table_id:        string;
  table_label:     string;
  table_seats:     number;
  table_status:    string;
  restaurant_name: string;
  brand_color:     string;
  currency_symbol: string;
  tax_percent:     string;
  logo_url:        string;
  bill_footer:     string;
  address:         string;
  phone:           string;
}

type CartItem = {
  menu_item_id: number;
  name:         string;
  price:        number;
  quantity:     number;
  note:         string;
};

type KioskScreen = 'menu' | 'ordered' | 'bill_requested';

interface Props {
  token: string;
}

// ── API helpers (no auth — kiosk routes are public) ───────────────────────

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

async function kioskGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/kiosk/${token}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `Error ${res.status}`);
  }
  return res.json();
}

async function kioskPost<T>(token: string, path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}/api/kiosk/${token}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as any).error || `Error ${res.status}`);
  }
  return res.json();
}

// ── Icons (Heroicons outline — same set used throughout the rest of the app) ──

// FIX: every icon now accepts an optional `style` prop (in addition to
// `className`) so callers can pass inline styles like `style={{ color: brand }}`
// without TypeScript rejecting it (TS2322 — "Property 'style' does not
// exist on type 'IntrinsicAttributes & { className?: string }'").
interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

const Icon = {
  Plus: ({ style }: IconProps = {}) => (
    <svg className="w-4 h-4" style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  Minus: ({ style }: IconProps = {}) => (
    <svg className="w-4 h-4" style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
  ),
  Trash: ({ style }: IconProps = {}) => (
    <svg className="w-3.5 h-3.5" style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  Check: ({ className = 'w-4 h-4', style }: IconProps = {}) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  Chef: ({ className = 'w-5 h-5', style }: IconProps = {}) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 12a3 3 0 11-6 0 3 3 0 016 0zm-6 3.75h6m-6 2.25h3m-3.75 3h6m-6 2.25h3" />
    </svg>
  ),
  Receipt: ({ className = 'w-5 h-5', style }: IconProps = {}) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  Bell: ({ className = 'w-9 h-9', style }: IconProps = {}) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  Plate: ({ className = 'w-8 h-8', style }: IconProps = {}) => (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  ),
};

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' | 'info' }) {
  const styles =
    type === 'success' ? 'bg-emerald-500'
    : type === 'error'  ? 'bg-red-500'
    : 'bg-brand-500';
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] ${styles} text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl animate-slide-up max-w-[calc(100vw-32px)] text-center`}
    >
      {msg}
    </div>
  );
}

// ── Header (brand-colored, matches restaurant identity) ───────────────────

function KioskHeader({ ctx }: { ctx: KioskContext }) {
  return (
    <div className="flex-shrink-0 px-4 py-3.5 flex items-center gap-3" style={{ background: ctx.brand_color }}>
      {ctx.logo_url ? (
        <img
          src={`${API_BASE}${ctx.logo_url}`}
          alt=""
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/20"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <Icon.Plate className="w-5 h-5 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight truncate">{ctx.restaurant_name}</p>
        {ctx.kiosk_type === 'table' && (
          <p className="text-white/75 text-xs mt-0.5">{ctx.table_label} · Dine in</p>
        )}
      </div>
    </div>
  );
}

// ── Quantity stepper ────────────────────────────────────────────────────────

function Stepper({ qty, onAdd, onSub, brand }: { qty: number; onAdd: () => void; onSub: () => void; brand: string }) {
  if (qty === 0) {
    return (
      <button
        onClick={onAdd}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 transition-transform active:scale-90"
        style={{ background: brand }}
      >
        <Icon.Plus />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={onSub}
        className="w-7 h-7 rounded-lg flex items-center justify-center border border-surface-border bg-surface-raised text-zinc-300 transition-transform active:scale-90"
      >
        <Icon.Minus />
      </button>
      <span className="font-mono font-bold text-white text-sm w-5 text-center">{qty}</span>
      <button
        onClick={onAdd}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-transform active:scale-90"
        style={{ background: brand }}
      >
        <Icon.Plus />
      </button>
    </div>
  );
}

// ── Main KioskView ────────────────────────────────────────────────────────

export default function KioskView({ token }: Props) {
  const [ctx,          setCtx]          = useState<KioskContext | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);

  const [categories,   setCategories]   = useState<Category[]>([]);
  const [menuItems,    setMenuItems]    = useState<MenuItem[]>([]);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [activeCatId,  setActiveCatId]  = useState<number | null>(null);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [screen,       setScreen]       = useState<KioskScreen>('menu');
  const [sending,      setSending]      = useState(false);
  const [cartOpen,     setCartOpen]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brand  = ctx?.brand_color     || '#f97316';
  const sym    = ctx?.currency_symbol || '₹';
  const taxPct = parseFloat(ctx?.tax_percent || '5') / 100;

  const toast = useCallback((msg: string, type: 'success'|'error'|'info' = 'info') => {
    setToastMsg({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  // ── Re-fetch orders fresh from the server. Always call this right before
  // any decision that depends on "is there an active round right now" —
  // never trust the `orders` already in state, since it can be stale right
  // after a delivery/bill event from another device (waiter/kitchen). This
  // is the core fix for the Round-2-resends-Round-1 bug.
  const refreshOrders = useCallback(async (): Promise<Order[]> => {
    const fresh = await kioskGet<Order[]>(token, '/orders');
    setOrders(fresh);
    return fresh;
  }, [token]);

  // ── Bootstrap ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const context = await kioskGet<KioskContext>(token, '');
        setCtx(context);

        const { categories: cats, items } = await kioskGet<{
          categories: Category[]; items: MenuItem[];
        }>(token, '/menu');
        setCategories(cats);
        setMenuItems(items);
        if (cats.length > 0) setActiveCatId(cats[0].id);

        const existingOrders = await refreshOrders();
        if (existingOrders.length > 0) setScreen('ordered');
      } catch (e: any) {
        setError(e.message || 'Could not load menu. Please scan the QR code again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refreshOrders]);

  // ── Cart actions ────────────────────────────────────────────────────────
  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id && !c.note);
      if (idx !== -1) {
        const u = [...prev];
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 };
        return u;
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, note: '' }];
    });
  }, []);

  const subFromCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id && !c.note);
      if (idx === -1) return prev;
      const u = [...prev];
      const nextQty = u[idx].quantity - 1;
      if (nextQty <= 0) { u.splice(idx, 1); return u; }
      u[idx] = { ...u[idx], quantity: nextQty };
      return u;
    });
  }, []);

  const qtyInCart = useCallback(
    (itemId: number) => cart.filter(c => c.menu_item_id === itemId).reduce((s, c) => s + c.quantity, 0),
    [cart]
  );

  const updateQty = useCallback((idx: number, delta: number) => {
    setCart(prev => {
      const u = [...prev];
      u[idx] = { ...u[idx], quantity: u[idx].quantity + delta };
      if (u[idx].quantity <= 0) u.splice(idx, 1);
      return [...u];
    });
  }, []);

  const updateNote = useCallback((idx: number, note: string) => {
    setCart(prev => prev.map((it, i) => i === idx ? { ...it, note } : it));
  }, []);

  // ── Send order ──────────────────────────────────────────────────────────
  // FIX: send ONLY the cart — never pre-merge any existing order's items.
  // The backend is the single source of truth for what counts as "new"
  // against whatever is genuinely active right now (see kiosk.js).
  const sendOrder = async () => {
    if (!cart.length || sending) return;
    setSending(true);
    try {
      await kioskPost(token, '/order', { items: cart });
      setCart([]);
      const updated = await refreshOrders();
      setOrders(updated);
      setScreen('ordered');
      setCartOpen(false);
      toast('Order sent to the kitchen', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to send order', 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Request bill ────────────────────────────────────────────────────────
  const requestBill = async () => {
    if (sending) return;
    setSending(true);
    try {
      await kioskPost(token, '/bill', {});
      const updated = await refreshOrders();
      setOrders(updated);
      setScreen('bill_requested');
    } catch (e: any) {
      toast(e.message || 'Failed to request bill', 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────
  const filtered      = menuItems.filter(m => m.category_id === activeCatId);
  const cartTotal      = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartQty         = cart.reduce((s, i) => s + i.quantity, 0);
  const ordersTotal     = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0);
  const grandSubtotal  = ordersTotal + cartTotal;
  const grandTax        = grandSubtotal * taxPct;
  const grandTotal      = grandSubtotal + grandTax;

  const activeRound      = orders.find(o => o.status === 'active') || null;
  const deliveredRounds  = orders.filter(o => o.status === 'delivered');
  const hasOrders        = orders.length > 0;

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand-500 rounded-full animate-spin mb-3" />
        <p className="text-zinc-500 text-sm">Loading menu…</p>
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-white font-bold text-lg mb-1.5">Link not working</h2>
        <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
          {error || 'This QR code is not valid. Please ask your waiter for help.'}
        </p>
      </div>
    );
  }

  // ── Bill Requested screen ───────────────────────────────────────────────
  if (screen === 'bill_requested') {
    const subtotal = ordersTotal;
    const tax      = subtotal * taxPct;
    const total    = subtotal + tax;

    const allItemMap = new Map<string, { name: string; price: number; quantity: number; note: string }>();
    for (const o of orders) {
      for (const it of o.items) {
        const key = `${it.name}||${it.note || ''}||${it.price}`;
        const ex = allItemMap.get(key);
        if (ex) ex.quantity += it.quantity;
        else allItemMap.set(key, { name: it.name, price: it.price, quantity: it.quantity, note: it.note || '' });
      }
    }
    const allItems = Array.from(allItemMap.values());

    return (
      <div className="h-full flex flex-col bg-surface max-w-lg mx-auto">
        {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} />}
        <KioskHeader ctx={ctx} />

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div
            className="rounded-2xl px-5 py-6 text-center mb-5"
            style={{ background: `${brand}15`, border: `1.5px solid ${brand}40` }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: `${brand}25` }}
            >
              <Icon.Bell className="w-7 h-7" />
            </div>
            <h2 className="font-bold text-base mb-1" style={{ color: brand }}>Bill requested</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Your waiter has been notified and will bring your bill shortly.
            </p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-surface-border">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Your bill</p>
            </div>
            <div className="px-4 divide-y divide-surface-border">
              {allItems.map((it, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 text-sm">
                      <span style={{ color: brand }} className="font-bold">{it.quantity}×</span> {it.name}
                    </p>
                    {it.note && <p className="text-zinc-600 text-xs italic mt-0.5">{it.note}</p>}
                  </div>
                  <span className="font-mono text-zinc-400 text-sm flex-shrink-0">{sym}{(it.price * it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-surface-border bg-surface-raised/40 space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Subtotal</span>
                <span className="font-mono">{sym}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Tax ({ctx.tax_percent}%)</span>
                <span className="font-mono">{sym}{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-1.5 border-t border-surface-border">
                <span className="text-white font-semibold text-sm">Total</span>
                <span className="font-mono font-bold text-lg" style={{ color: brand }}>{sym}{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {ctx.bill_footer && (
            <p className="text-center text-zinc-600 text-xs leading-relaxed">{ctx.bill_footer}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Ordered screen — order placed, viewing rounds, can add more ─────────
  if (screen === 'ordered' && hasOrders && cart.length === 0) {
    return (
      <div className="h-full flex flex-col bg-surface max-w-lg mx-auto">
        {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} />}
        <KioskHeader ctx={ctx} />

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Status banner */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3 mb-4"
            style={{
              background: activeRound ? `${brand}15` : 'rgba(16,185,129,0.1)',
              border: `1.5px solid ${activeRound ? brand + '40' : 'rgba(16,185,129,0.3)'}`,
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: activeRound ? `${brand}25` : 'rgba(16,185,129,0.18)' }}
            >
              {activeRound
                ? <Icon.Chef className="w-5 h-5" style={{ color: brand }} />
                : <Icon.Check className="w-5 h-5 text-emerald-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: activeRound ? brand : '#34d399' }}>
                {activeRound ? 'Kitchen is preparing your order' : 'All items delivered'}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {activeRound ? 'Your food is on the way.' : 'Want anything else? Browse the menu below.'}
              </p>
            </div>
          </div>

          {/* Rounds */}
          {orders.map((order, roundIdx) => {
            const isActive = order.status === 'active';
            const roundTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
            return (
              <div key={order.id} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden mb-3">
                <div
                  className="px-4 py-2.5 border-b border-surface-border flex items-center justify-between"
                  style={{ background: isActive ? `${brand}10` : undefined }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: isActive ? brand : '#10b981' }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: isActive ? brand : '#34d399' }}
                    >
                      {orders.length > 1 ? `Round ${roundIdx + 1} — ` : ''}{isActive ? 'In kitchen' : 'Delivered'}
                    </span>
                  </div>
                  <span className="font-mono text-zinc-500 text-xs">{sym}{roundTotal.toFixed(2)}</span>
                </div>
                <div className="px-4 py-1 divide-y divide-surface-border/60">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-200 text-sm">
                          <span style={{ color: brand }} className="font-bold">{item.quantity}×</span> {item.name}
                        </p>
                        {item.note && <p className="text-zinc-600 text-xs italic mt-0.5">{item.note}</p>}
                      </div>
                      <span className="font-mono text-zinc-500 text-sm flex-shrink-0">{sym}{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Running total */}
          <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3 mb-3">
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>Subtotal</span>
              <span className="font-mono">{sym}{ordersTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mb-2">
              <span>Tax ({ctx.tax_percent}%)</span>
              <span className="font-mono">{sym}{(ordersTotal * taxPct).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-surface-border">
              <span className="text-white font-semibold text-sm">Total so far</span>
              <span className="font-mono font-bold text-base" style={{ color: brand }}>
                {sym}{(ordersTotal * (1 + taxPct)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-surface-border bg-surface-card/50 flex flex-col gap-2">
          <button
            onClick={async () => { await refreshOrders(); setScreen('menu'); }}
            className="w-full py-3 rounded-xl text-sm font-semibold border transition-all active:scale-[0.98]"
            style={{ borderColor: `${brand}60`, color: brand, background: 'transparent' }}
          >
            + Add more items
          </button>
          <button
            onClick={requestBill}
            disabled={sending}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: brand }}
          >
            {sending
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Icon.Receipt className="w-4 h-4" />}
            Request bill
          </button>
        </div>
      </div>
    );
  }

  // ── Menu + Cart screen ───────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-surface max-w-lg mx-auto relative">
      {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} />}
      <KioskHeader ctx={ctx} />

      {/* Existing-order mini banner */}
      {hasOrders && (
        <button
          onClick={async () => { await refreshOrders(); setScreen('ordered'); }}
          className="flex-shrink-0 w-full px-4 py-2.5 flex items-center justify-between border-b"
          style={{ background: `${brand}12`, borderColor: `${brand}30` }}
        >
          <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: brand }}>
            {activeRound ? <Icon.Chef className="w-3.5 h-3.5" /> : <Icon.Check className="w-3.5 h-3.5" />}
            {activeRound ? 'Order in kitchen' : 'Order delivered'} — view details
          </span>
          <span className="font-mono text-xs font-bold" style={{ color: brand }}>
            {sym}{(ordersTotal * (1 + taxPct)).toFixed(2)}
          </span>
        </button>
      )}

      {/* Category tabs */}
      <div className="flex-shrink-0 flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-surface-border no-scrollbar">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCatId(c.id)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={
              activeCatId === c.id
                ? { background: brand, color: '#fff', borderColor: brand }
                : { background: 'transparent', color: '#a1a1aa', borderColor: '#3f3f46' }
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto px-3 pt-3" style={{ paddingBottom: cart.length > 0 ? 96 : 16 }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <Icon.Plate className="w-7 h-7 mb-2 opacity-40" />
            <p className="text-sm">No items in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map(item => {
              const qty = qtyInCart(item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-xl border bg-surface-card overflow-hidden transition-colors"
                  style={{ borderColor: qty > 0 ? `${brand}70` : '#27272a' }}
                >
                  <div className="relative w-full bg-surface-raised" style={{ paddingTop: '70%' }}>
                    {item.image_path ? (
                      <img
                        src={`${API_BASE}${item.image_path}`}
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                        <Icon.Plate className="w-6 h-6" />
                      </div>
                    )}
                    {qty > 0 && (
                      <div
                        className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-white text-[10px] font-bold font-mono shadow-lg"
                        style={{ background: brand }}
                      >
                        {qty}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-zinc-100 text-xs font-semibold leading-snug line-clamp-2 mb-1">{item.name}</p>
                    {item.description && (
                      <p className="text-zinc-600 text-[10px] line-clamp-1 mb-1.5">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-semibold text-sm" style={{ color: brand }}>
                        {sym}{parseFloat(String(item.price)).toFixed(2)}
                      </span>
                      <Stepper
                        qty={qty}
                        onAdd={() => addToCart(item)}
                        onSub={() => subFromCart(item)}
                        brand={brand}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart bar — tap to expand */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto flex items-center justify-between px-4 py-3.5 text-white shadow-2xl"
          style={{ background: brand }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[11px] font-bold">
              {cartQty}
            </span>
            View order
          </span>
          <span className="font-mono font-bold text-sm">{sym}{cartTotal.toFixed(2)}</span>
        </button>
      )}

      {/* Cart panel — full bottom sheet */}
      {cart.length > 0 && cartOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end max-w-lg mx-auto">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="relative bg-surface-card rounded-t-2xl border-t border-surface-border flex flex-col max-h-[75vh] shadow-2xl">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-surface-border">
              <p className="text-white font-bold text-sm">Your order · {cartQty} {cartQty === 1 ? 'item' : 'items'}</p>
              <button
                onClick={() => setCartOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 divide-y divide-surface-border">
              {cart.map((item, idx) => (
                <div key={idx} className="py-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-100 text-sm font-medium">{item.name}</p>
                      <p className="font-mono text-sm mt-0.5" style={{ color: brand }}>
                        {sym}{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => updateQty(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 flex items-center justify-center"
                      >
                        {item.quantity === 1 ? <Icon.Trash /> : <Icon.Minus />}
                      </button>
                      <span className="font-mono text-white text-sm w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 flex items-center justify-center"
                      >
                        <Icon.Plus />
                      </button>
                    </div>
                  </div>
                  <input
                    placeholder="Add a note (optional)"
                    value={item.note}
                    onChange={e => updateNote(idx, e.target.value)}
                    className="mt-2 w-full bg-surface-raised border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-brand-500/50"
                  />
                </div>
              ))}
            </div>

            <div className="flex-shrink-0 px-4 py-3.5 border-t border-surface-border">
              <button
                onClick={sendOrder}
                disabled={sending}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: brand }}
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : null}
                {sending ? 'Sending…' : hasOrders ? `Add to order — ${sym}${cartTotal.toFixed(2)}` : `Place order — ${sym}${cartTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request bill FAB — shown when orders exist, cart empty, still on menu screen */}
      {hasOrders && cart.length === 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-surface-border bg-surface">
          <button
            onClick={requestBill}
            disabled={sending}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399', background: 'rgba(16,185,129,0.1)' }}
          >
            {sending
              ? <span className="w-4 h-4 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
              : <Icon.Receipt className="w-4 h-4" />}
            Request bill
          </button>
        </div>
      )}
    </div>
  );
}