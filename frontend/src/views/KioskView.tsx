/**
 * frontend/src/views/KioskView.tsx
 *
 * Customer-facing kiosk page, loaded when a QR code is scanned.
 * Completely isolated from the rest of the app:
 *   - No auth required
 *   - No TopBar, no nav, no logout
 *   - No access to other tables
 *   - Token in URL is opaque (base64url, not a table ID)
 *
 * Designed to be extensible: uses a `KioskContext` object rather than
 * assuming a table — future walk-up kiosks just need a different kiosk_type.
 *
 * What a customer can do:
 *   - Browse menu by category
 *   - Add items, adjust qty, add notes
 *   - Send order to kitchen
 *   - View their current order (delivered rounds + active round)
 *   - Add more items (new round)
 *   - Request bill (alerts waiter, shows bill summary)
 *
 * What they CANNOT do:
 *   - Cancel items (waiter's job — avoids abuse)
 *   - Access any other page
 *   - See or edit the table ID in the URL
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

type KioskScreen = 'menu' | 'cart' | 'ordered' | 'bill_requested';

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

// ── Small reusable components ─────────────────────────────────────────────

function Spinner({ color = '#fff' }: { color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 18, height: 18,
      border: `2.5px solid ${color}40`, borderTopColor: color,
      borderRadius: '50%', animation: 'kspin 0.7s linear infinite',
    }} />
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' | 'info' }) {
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1';
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', padding: '10px 20px',
      borderRadius: 12, fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: 9999, animation: 'kfadein 0.2s ease',
      maxWidth: 'calc(100vw - 32px)', textAlign: 'center',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      {msg}
    </div>
  );
}

// ── Main KioskView ────────────────────────────────────────────────────────

export default function KioskView({ token }: Props) {
  const [ctx,          setCtx]          = useState<KioskContext | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);

  const [categories,   setCategories]   = useState<Category[]>([]);
  const [menuItems,    setMenuItems]     = useState<MenuItem[]>([]);
  const [orders,       setOrders]        = useState<Order[]>([]);
  const [activeCatId,  setActiveCatId]   = useState<number | null>(null);
  const [cart,         setCart]          = useState<CartItem[]>([]);
  const [screen,       setScreen]        = useState<KioskScreen>('menu');
  const [sending,      setSending]       = useState(false);
  const [toastMsg,     setToastMsg]      = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brand  = ctx?.brand_color     || '#f97316';
  const sym    = ctx?.currency_symbol || '₹';
  const taxPct = parseFloat(ctx?.tax_percent || '5') / 100;

  // ── Toast helper ────────────────────────────────────────────────────────
  const toast = useCallback((msg: string, type: 'success'|'error'|'info' = 'info') => {
    setToastMsg({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // ── Bootstrap: load context + menu ─────────────────────────────────────
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

        // Load any existing orders for this table
        const existingOrders = await kioskGet<Order[]>(token, '/orders');
        setOrders(existingOrders);

        // If table already has orders, go to the order screen
        if (existingOrders.length > 0) setScreen('ordered');
      } catch (e: any) {
        setError(e.message || 'Could not load menu. Please scan the QR code again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Cart actions ────────────────────────────────────────────────────────
  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id && !c.note);
      if (idx !== -1) {
        const u = [...prev];
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 };
        return u;
      }
      return [...prev, {
        menu_item_id: item.id,
        name:         item.name,
        price:        item.price,
        quantity:     1,
        note:         '',
      }];
    });
  }, []);

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
  const sendOrder = async () => {
    if (!cart.length || sending) return;
    setSending(true);
    try {
      // Merge cart with current active order items (same as waiter)
      const activeOrder = orders.find(o => o.status === 'active');
      let itemsToSend = [...cart];
      if (activeOrder) {
        const activeItems = activeOrder.items.map(i => ({
          menu_item_id: i.menu_item_id,
          name: i.name, price: i.price,
          quantity: i.quantity, note: i.note || '',
        }));
        itemsToSend = [...activeItems, ...cart];
      }

      await kioskPost(token, '/order', { items: itemsToSend });
      setCart([]);

      // Reload orders
      const updated = await kioskGet<Order[]>(token, '/orders');
      setOrders(updated);
      setScreen('ordered');
      toast('Order sent to kitchen!', 'success');
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
      // Reload to get updated orders
      const updated = await kioskGet<Order[]>(token, '/orders');
      setOrders(updated);
      setScreen('bill_requested');
    } catch (e: any) {
      toast(e.message || 'Failed to request bill', 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────
  const filtered     = menuItems.filter(m => m.category_id === activeCatId);
  const cartTotal    = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartQty      = cart.reduce((s, i) => s + i.quantity, 0);
  const ordersTotal  = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.quantity, 0), 0);
  const grandSubtotal = ordersTotal + cartTotal;
  const grandTax     = grandSubtotal * taxPct;
  const grandTotal   = grandSubtotal + grandTax;

  const deliveredRounds = orders.filter(o => o.status === 'delivered');
  const activeRound     = orders.find(o => o.status === 'active') || null;
  const hasOrders       = orders.length > 0;
  const hasBillableOrder = hasOrders;

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.fullCenter}>
        <style>{kioskCSS}</style>
        <Spinner color="#888" />
        <p style={{ color: '#888', fontSize: 14, marginTop: 12 }}>Loading menu…</p>
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div style={styles.fullCenter}>
        <style>{kioskCSS}</style>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ color: '#fff', fontSize: 20, margin: '0 0 8px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            Invalid QR Code
          </h2>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            {error || 'This QR code is not valid. Please ask your waiter for help.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Bill Requested screen ───────────────────────────────────────────────
  if (screen === 'bill_requested') {
    const subtotal = ordersTotal;
    const tax      = subtotal * taxPct;
    const total    = subtotal + tax;

    // Flatten all ordered items
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
      <div style={{ ...styles.page, background: '#18181b' }}>
        <style>{kioskCSS}</style>
        {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} />}

        {/* Header */}
        <KioskHeader ctx={ctx} brand={brand} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          {/* Success message */}
          <div style={{
            textAlign: 'center', padding: '24px 16px 20px',
            background: `${brand}15`, border: `1.5px solid ${brand}40`,
            borderRadius: 16, marginBottom: 20,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>
            <h2 style={{ color: brand, fontSize: 18, fontWeight: 700, margin: '0 0 6px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
              Bill Requested
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0, lineHeight: 1.5, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
              Your waiter has been notified and will bring your bill shortly.
            </p>
          </div>

          {/* Bill summary */}
          <div style={{ background: '#1f1f23', borderRadius: 16, border: '1px solid #27272a', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #27272a' }}>
              <p style={{ color: '#71717a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                Your Bill
              </p>
            </div>
            <div style={{ padding: '12px 16px' }}>
              {allItems.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: i < allItems.length - 1 ? '1px solid #27272a' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                      <span style={{ color: brand, fontWeight: 700 }}>{it.quantity}×</span> {it.name}
                    </span>
                    {it.note && <div style={{ color: '#71717a', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>{it.note}</div>}
                  </div>
                  <span style={{ color: '#a1a1aa', fontSize: 13, fontFamily: 'ui-monospace,monospace', marginLeft: 12 }}>
                    {sym}{(it.price * it.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #27272a', background: '#27272a30' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#71717a', fontSize: 12, fontFamily: 'system-ui,-apple-system,sans-serif' }}>Subtotal</span>
                <span style={{ color: '#a1a1aa', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>{sym}{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#71717a', fontSize: 12, fontFamily: 'system-ui,-apple-system,sans-serif' }}>Tax ({ctx.tax_percent}%)</span>
                <span style={{ color: '#a1a1aa', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>{sym}{tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'system-ui,-apple-system,sans-serif' }}>Total</span>
                <span style={{ color: brand, fontSize: 18, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>{sym}{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {ctx.bill_footer && (
            <p style={{ textAlign: 'center', color: '#52525b', fontSize: 12, lineHeight: 1.5, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
              {ctx.bill_footer}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Ordered screen (order placed, can add more or request bill) ──────────
  if (screen === 'ordered' && hasOrders && cart.length === 0) {
    return (
      <div style={{ ...styles.page, background: '#18181b' }}>
        <style>{kioskCSS}</style>
        {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} />}

        <KioskHeader ctx={ctx} brand={brand} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* Status banner */}
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: activeRound ? `${brand}18` : '#10b98118',
            border: `1.5px solid ${activeRound ? brand + '50' : '#10b98150'}`,
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>{activeRound ? '👨‍🍳' : '✅'}</span>
            <div>
              <p style={{ color: activeRound ? brand : '#10b981', fontSize: 13, fontWeight: 700, margin: '0 0 2px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                {activeRound ? 'Order received — kitchen is preparing it' : 'All items delivered!'}
              </p>
              <p style={{ color: '#71717a', fontSize: 11, margin: 0, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                {activeRound ? 'Your food is being prepared.' : 'Want anything else? Browse the menu below.'}
              </p>
            </div>
          </div>

          {/* Order summary */}
          {orders.map((order, roundIdx) => {
            const isActive = order.status === 'active';
            const roundTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
            return (
              <div key={order.id} style={{ background: '#1f1f23', borderRadius: 14, border: '1px solid #27272a', marginBottom: 12, overflow: 'hidden' }}>
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid #27272a',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: isActive ? `${brand}15` : '#27272a30',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? brand : '#10b981', display: 'inline-block' }} />
                    <span style={{ color: isActive ? brand : '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                      {orders.length > 1 ? `Round ${roundIdx + 1} — ` : ''}{isActive ? 'In Kitchen' : 'Delivered'}
                    </span>
                  </div>
                  <span style={{ color: '#71717a', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
                    {sym}{roundTotal.toFixed(2)}
                  </span>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                          <span style={{ color: brand, fontWeight: 700 }}>{item.quantity}×</span> {item.name}
                        </span>
                        {item.note && <div style={{ color: '#71717a', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>{item.note}</div>}
                      </div>
                      <span style={{ color: '#71717a', fontSize: 12, fontFamily: 'ui-monospace,monospace', marginLeft: 12 }}>
                        {sym}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Running total */}
          <div style={{
            background: '#1f1f23', border: '1px solid #27272a', borderRadius: 14,
            padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#71717a', fontSize: 12, fontFamily: 'system-ui,-apple-system,sans-serif' }}>Subtotal</span>
              <span style={{ color: '#a1a1aa', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>{sym}{ordersTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#71717a', fontSize: 12, fontFamily: 'system-ui,-apple-system,sans-serif' }}>Tax ({ctx.tax_percent}%)</span>
              <span style={{ color: '#a1a1aa', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>{sym}{(ordersTotal * taxPct).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'system-ui,-apple-system,sans-serif' }}>Total so far</span>
              <span style={{ color: brand, fontSize: 16, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>
                {sym}{(ordersTotal * (1 + taxPct)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '12px 16px 24px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => setScreen('menu')}
            style={{ ...styles.btnOutline(brand), width: '100%' }}
          >
            + Order More Items
          </button>
          <button
            onClick={requestBill}
            disabled={sending || !hasBillableOrder}
            style={{ ...styles.btnPrimary(brand), width: '100%' }}
          >
            {sending ? <Spinner /> : '🧾 Request Bill'}
          </button>
        </div>
      </div>
    );
  }

  // ── Menu + Cart screen ───────────────────────────────────────────────────
  return (
    <div style={{ ...styles.page, background: '#18181b' }}>
      <style>{kioskCSS}</style>
      {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} />}

      <KioskHeader ctx={ctx} brand={brand} />

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 16px',
        borderBottom: '1px solid #27272a', flexShrink: 0,
        scrollbarWidth: 'none',
      }}>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCatId(c.id)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 99,
              border: `1.5px solid ${activeCatId === c.id ? brand : '#3f3f46'}`,
              background: activeCatId === c.id ? brand : 'transparent',
              color: activeCatId === c.id ? '#fff' : '#a1a1aa',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui,-apple-system,sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Current order mini-banner (if orders exist) */}
      {hasOrders && (
        <button
          onClick={() => setScreen('ordered')}
          style={{
            width: '100%', padding: '10px 16px', background: `${brand}18`,
            border: 'none', borderBottom: `1.5px solid ${brand}40`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span style={{ color: brand, fontSize: 12, fontWeight: 600, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            {activeRound ? '👨‍🍳 Order in kitchen' : '✅ Order delivered'} — tap to view
          </span>
          <span style={{ color: brand, fontSize: 12, fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>
            {sym}{(ordersTotal * (1 + taxPct)).toFixed(2)}
          </span>
        </button>
      )}

      {/* Menu grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#52525b', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            No items in this category
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            paddingBottom: cart.length > 0 ? 140 : 16,
          }}>
            {filtered.map(item => {
              const qty = cart.filter(c => c.menu_item_id === item.id).reduce((s, c) => s + c.quantity, 0);
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  style={{
                    background: qty > 0 ? `${brand}18` : '#1f1f23',
                    border: `1.5px solid ${qty > 0 ? brand + '60' : '#27272a'}`,
                    borderRadius: 14, overflow: 'hidden', textAlign: 'left',
                    cursor: 'pointer', padding: 0, transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  {/* Image */}
                  <div style={{ width: '100%', paddingTop: '65%', position: 'relative', background: '#27272a' }}>
                    {item.image_path ? (
                      <img
                        src={`${API_BASE}${item.image_path}`}
                        alt={item.name}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3f3f46', fontSize: 24 }}>
                        🍽
                      </div>
                    )}
                    {qty > 0 && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        background: brand, color: '#fff',
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace,monospace',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      }}>
                        {qty}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ color: '#e4e4e7', fontSize: 12, fontWeight: 600, margin: '0 0 2px', lineHeight: 1.3, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p style={{ color: '#71717a', fontSize: 10, margin: '0 0 4px', lineHeight: 1.3, fontFamily: 'system-ui,-apple-system,sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                        {item.description}
                      </p>
                    )}
                    <p style={{ color: brand, fontSize: 13, fontWeight: 700, margin: 0, fontFamily: 'ui-monospace,monospace' }}>
                      {sym}{parseFloat(String(item.price)).toFixed(2)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart panel — slides up when items are in cart */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#1f1f23', borderTop: `2px solid ${brand}`,
          zIndex: 100, maxHeight: '55vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Cart header */}
          <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
              Your order ({cartQty} {cartQty === 1 ? 'item' : 'items'})
            </span>
            <span style={{ color: brand, fontSize: 14, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>
              {sym}{cartTotal.toFixed(2)}
            </span>
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
            {cart.map((item, idx) => (
              <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #27272a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => updateQty(idx, -1)}
                      style={{ ...styles.qtyBtn, color: item.quantity === 1 ? '#ef4444' : '#a1a1aa' }}
                    >
                      {item.quantity === 1 ? '✕' : '−'}
                    </button>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace,monospace', minWidth: 20, textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button onClick={() => updateQty(idx, 1)} style={styles.qtyBtn}>+</button>
                  </div>
                  <span style={{ flex: 1, color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
                    {item.name}
                  </span>
                  <span style={{ color: '#a1a1aa', fontSize: 12, fontFamily: 'ui-monospace,monospace', flexShrink: 0 }}>
                    {sym}{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                <input
                  placeholder="Add a note (optional)"
                  value={item.note}
                  onChange={e => updateNote(idx, e.target.value)}
                  style={{
                    marginTop: 6, width: '100%', background: '#27272a',
                    border: '1px solid #3f3f46', borderRadius: 8,
                    color: '#e4e4e7', fontSize: 12, padding: '6px 10px',
                    fontFamily: 'system-ui,-apple-system,sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Send button */}
          <div style={{ padding: '10px 16px 24px', flexShrink: 0 }}>
            <button
              onClick={sendOrder}
              disabled={sending}
              style={{ ...styles.btnPrimary(brand), width: '100%' }}
            >
              {sending
                ? <Spinner />
                : hasOrders
                  ? `Add to Order — ${sym}${cartTotal.toFixed(2)}`
                  : `Place Order — ${sym}${cartTotal.toFixed(2)}`
              }
            </button>
          </div>
        </div>
      )}

      {/* Request bill FAB — shown when orders exist and cart is empty */}
      {hasOrders && cart.length === 0 && screen === 'menu' && (
        <div style={{ padding: '10px 16px 24px', borderTop: '1px solid #27272a', flexShrink: 0, background: '#18181b' }}>
          <button
            onClick={requestBill}
            disabled={sending}
            style={{
              ...styles.btnPrimary('#10b981'),
              width: '100%',
              border: '1.5px solid #10b98150',
              background: '#10b98118',
              color: '#10b981',
            }}
          >
            {sending ? <Spinner color="#10b981" /> : '🧾 Request Bill'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Kiosk header component ────────────────────────────────────────────────

function KioskHeader({ ctx, brand }: { ctx: KioskContext; brand: string }) {
  return (
    <div style={{
      background: brand, padding: '14px 16px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      flexShrink: 0,
    }}>
      {ctx.logo_url && (
        <img
          src={`${process.env.REACT_APP_API_URL || window.location.origin}${ctx.logo_url}`}
          alt="logo"
          style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0, fontFamily: 'system-ui,-apple-system,sans-serif', lineHeight: 1.2 }}>
          {ctx.restaurant_name}
        </p>
        {ctx.kiosk_type === 'table' && (
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: '2px 0 0', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            {ctx.table_label} • Dine in
          </p>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display:       'flex' as const,
    flexDirection: 'column' as const,
    height:        '100dvh',
    overflow:      'hidden',
    maxWidth:      480,
    margin:        '0 auto',
  },
  fullCenter: {
    display:        'flex' as const,
    flexDirection:  'column' as const,
    alignItems:     'center' as const,
    justifyContent: 'center' as const,
    height:         '100dvh',
    background:     '#18181b',
    fontFamily:     'system-ui,-apple-system,sans-serif',
  },
  btnPrimary: (color: string) => ({
    background:  color,
    color:       '#fff',
    border:      'none',
    borderRadius: 12,
    padding:     '14px 20px',
    fontSize:    15,
    fontWeight:  700,
    cursor:      'pointer',
    display:     'flex' as const,
    alignItems:  'center' as const,
    justifyContent: 'center' as const,
    gap:         8,
    fontFamily:  'system-ui,-apple-system,sans-serif',
    transition:  'opacity 0.15s',
  }),
  btnOutline: (color: string) => ({
    background:  'transparent',
    color:       color,
    border:      `1.5px solid ${color}60`,
    borderRadius: 12,
    padding:     '12px 20px',
    fontSize:    14,
    fontWeight:  600,
    cursor:      'pointer',
    display:     'flex' as const,
    alignItems:  'center' as const,
    justifyContent: 'center' as const,
    gap:         8,
    fontFamily:  'system-ui,-apple-system,sans-serif',
  }),
  qtyBtn: {
    width:       28,
    height:      28,
    borderRadius: 8,
    background:  '#27272a',
    border:      '1px solid #3f3f46',
    color:       '#a1a1aa',
    fontSize:    16,
    cursor:      'pointer',
    display:     'flex' as const,
    alignItems:  'center' as const,
    justifyContent: 'center' as const,
    lineHeight:  1,
    padding:     0,
    fontFamily:  'system-ui,-apple-system,sans-serif',
  },
};

const kioskCSS = `
  @keyframes kspin   { to { transform: rotate(360deg); } }
  @keyframes kfadein { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  input { outline: none; }
  input::placeholder { color: #52525b; }
  button:active { opacity: 0.8; }
  ::-webkit-scrollbar { display: none; }
`;