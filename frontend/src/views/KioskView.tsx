/**
 * frontend/src/views/KioskView.tsx  —  COMPLETE REDESIGN
 *
 * Layout approach:
 *   - Page = full-height flex column: Header | CatTabs | [OrderBanner] | MenuScroll
 *   - MenuScroll takes all remaining space and scrolls internally
 *   - Cart is position:fixed bottom sheet — overlays the menu, never pushes it
 *   - Menu gets padding-bottom equal to the cart panel height so content
 *     is never hidden behind the cart
 *
 * Fixes:
 *   - No emojis
 *   - Toast top-right
 *   - Cart never covers entire screen — capped at 50vh, scrolls internally
 *   - Header subtitle correct for parcel vs dine-in (uses backend is_parcel flag)
 *   - Stale closure bug in order_closed fixed
 *   - Socket.io live updates
 *   - 30s polling fallback
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { MenuItem, Category, Order } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KioskCtx {
  kiosk_type:      string;
  table_id:        string;
  table_label:     string;
  table_seats:     number;
  table_status:    string;
  is_parcel:       boolean;
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
  name:  string;
  price: number;
  quantity: number;
  note:  string;
};

type Screen = 'menu' | 'ordered' | 'bill_requested' | 'session_ended';

const API = (process.env.REACT_APP_API_URL || window.location.origin).replace(/\/$/, '');
const FF  = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const FM  = "ui-monospace,'SF Mono',monospace";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function kGet<T>(tok: string, path: string): Promise<T> {
  const r = await fetch(`${API}/api/kiosk/${tok}${path}`);
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as any).error || `${r.status}`); }
  return r.json();
}

async function kPost<T>(tok: string, path: string, body: object): Promise<T> {
  const r = await fetch(`${API}/api/kiosk/${tok}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as any).error || `${r.status}`); }
  return r.json();
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spin({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return <span style={{ display:'inline-block', width:size, height:size, border:`2px solid ${color}30`, borderTopColor:color, borderRadius:'50%', animation:'kspin .7s linear infinite', flexShrink:0 }} />;
}

function Toast({ msg, type }: { msg: string; type: 'ok'|'err'|'info' }) {
  const bg = type==='ok' ? '#16a34a' : type==='err' ? '#dc2626' : '#4f46e5';
  return (
    <div style={{ position:'fixed', top:14, right:14, zIndex:9999, background:bg, color:'#fff',
      padding:'10px 16px', borderRadius:10, fontSize:13, fontWeight:600, fontFamily:FF,
      boxShadow:'0 4px 24px rgba(0,0,0,.4)', maxWidth:260, lineHeight:1.4,
      animation:'kIn .18s ease', pointerEvents:'none' }}>
      {msg}
    </div>
  );
}

// Icon components — no emojis
function IconChef({ c, s=18 }:{ c:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M6 13.121v2.634a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5v-2.634m-12 0a2.25 2.25 0 00-.75 1.657v.003c0 .621.503 1.125 1.125 1.125h13.5c.621 0 1.125-.504 1.125-1.125v-.003a2.25 2.25 0 00-.75-1.657m-12 0l-.375-.375m12.375.375l.375-.375" /></svg>;
}
function IconCheck({ c, s=18 }:{ c:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
}
function IconBell({ c, s=18 }:{ c:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
}
function IconPhoto({ c='#3f3f46', s=24 }:{ c?:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg>;
}
function IconX({ c='#71717a', s=14 }:{ c?:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
function IconMinus({ c='#71717a', s=12 }:{ c?:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>;
}
function IconPlus({ c='#71717a', s=12 }:{ c?:string; s?:number }) {
  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KioskView({ token }: { token: string }) {
  const [ctx,        setCtx]        = useState<KioskCtx | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [booting,    setBooting]    = useState(true);
  const [cats,       setCats]       = useState<Category[]>([]);
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [catId,      setCatId]      = useState<number | null>(null);
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [screen,     setScreen]     = useState<Screen>('menu');
  const [busy,       setBusy]       = useState(false);
  const [toast,      setToast]      = useState<{ msg:string; type:'ok'|'err'|'info' }|null>(null);
  // Cart is collapsed (pill) by default, expands when user taps it
  const [cartOpen,   setCartOpen]   = useState(false);
  // Track cart panel height so we can pad the menu scroll area
  const [cartH,      setCartH]      = useState(0);
  const cartRef  = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket|null>(null);
  const tidRef    = useRef<string>('');
  const pollRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const toastRef  = useRef<ReturnType<typeof setTimeout>|null>(null);

  const showToast = useCallback((msg: string, type: 'ok'|'err'|'info' = 'info') => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchOrders = useCallback(async (): Promise<Order[]> => {
    try { const o = await kGet<Order[]>(token, '/orders'); setOrders(o); return o; }
    catch { return []; }
  }, [token]);

  // Measure cart panel height whenever it changes so we can set menu padding
  useEffect(() => {
    if (!cartRef.current) { setCartH(0); return; }
    const ro = new ResizeObserver(entries => {
      setCartH(entries[0]?.contentRect.height ?? 0);
    });
    ro.observe(cartRef.current);
    return () => ro.disconnect();
  });

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [c, { categories, items: its }, existingOrders] = await Promise.all([
          kGet<KioskCtx>(token, ''),
          kGet<{ categories: Category[]; items: MenuItem[] }>(token, '/menu'),
          kGet<Order[]>(token, '/orders'),
        ]);
        setCtx(c);
        tidRef.current = c.table_id;
        setCats(categories);
        setItems(its);
        setCatId(categories[0]?.id ?? null);
        setOrders(existingOrders);
        if (existingOrders.length > 0) setScreen('ordered');
      } catch (e: any) {
        setError(e.message || 'Could not load. Please scan QR again.');
      } finally {
        setBooting(false);
      }
    })();

    // ── Socket ───────────────────────────────────────────────────────────
    const sock = io(API || window.location.origin, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('order_delivered', ({ order }: { order: Order }) => {
      if (order.table_id !== tidRef.current) return;
      setOrders(p => p.map(o => o.id === order.id ? order : o));
      showToast('Your food is ready', 'ok');
    });

    sock.on('order_updated', ({ order }: { order: Order }) => {
      if (order.table_id !== tidRef.current) return;
      setOrders(p => p.some(o => o.id === order.id) ? p.map(o => o.id === order.id ? order : o) : [...p, order]);
    });

    sock.on('new_order', ({ order }: { order: Order }) => {
      if (order.table_id !== tidRef.current) return;
      setOrders(p => p.some(o => o.id === order.id) ? p : [...p, order]);
    });

    sock.on('order_closed', ({ tableId }: { tableId: string }) => {
      if (tableId !== tidRef.current) return;
      // Fetch fresh to avoid stale-closure bug
      kGet<Order[]>(token, '/orders').then(fresh => {
        setOrders(fresh);
        if (!fresh.some(o => o.status === 'active' || o.status === 'delivered'))
          setScreen('session_ended');
      }).catch(() => setScreen('session_ended'));
    });

    sock.on('tables_updated', () => { fetchOrders(); });

    pollRef.current = setInterval(fetchOrders, 30000);

    return () => {
      sock.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, [token]); // eslint-disable-line

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addItem = useCallback((item: MenuItem) => {
    setCart(p => {
      const i = p.findIndex(c => c.menu_item_id === item.id && !c.note);
      if (i !== -1) { const u=[...p]; u[i]={...u[i],quantity:u[i].quantity+1}; return u; }
      return [...p,{ menu_item_id:item.id, name:item.name, price:item.price, quantity:1, note:'' }];
    });
    // Auto-open briefly so user sees the item was added, then collapses
    setCartOpen(true);
  }, []);

  const setQty = useCallback((i: number, delta: number) => {
    setCart(p => {
      const u=[...p]; u[i]={...u[i],quantity:u[i].quantity+delta};
      if (u[i].quantity<=0) u.splice(i,1); return u;
    });
  }, []);

  const setNote = useCallback((i: number, note: string) => {
    setCart(p => p.map((it,idx) => idx===i ? {...it,note} : it));
  }, []);

  // ── Place order ───────────────────────────────────────────────────────────
  const placeOrder = async () => {
    if (!cart.length || busy) return;
    setBusy(true);
    try {
      const active = orders.find(o => o.status==='active');
      const base   = active ? active.items.map(i=>({
        menu_item_id:i.menu_item_id, name:i.name, price:i.price, quantity:i.quantity, note:i.note||'',
      })) : [];
      await kPost(token, '/order', { items:[...base,...cart] });
      setCart([]);
      setCartOpen(false);
      await fetchOrders();
      setScreen('ordered');
      showToast('Order sent to kitchen', 'ok');
    } catch (e: any) {
      showToast(e.message || 'Failed to place order', 'err');
    } finally { setBusy(false); }
  };

  // ── Request bill ──────────────────────────────────────────────────────────
  const reqBill = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await kPost(token, '/bill', {});
      await fetchOrders();
      setScreen('bill_requested');
    } catch (e: any) {
      showToast(e.message || 'Failed to request bill', 'err');
    } finally { setBusy(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const brand       = ctx?.brand_color     || '#f97316';
  const sym         = ctx?.currency_symbol || '₹';
  const taxPct      = parseFloat(ctx?.tax_percent || '5') / 100;
  const filtered    = items.filter(m => m.category_id === catId);
  const cartQty     = cart.reduce((s,i) => s+i.quantity, 0);
  const cartSub     = cart.reduce((s,i) => s+i.price*i.quantity, 0);
  const ordersSub   = orders.reduce((s,o) => s+o.items.reduce((ss,i)=>ss+i.price*i.quantity,0), 0);
  const hasOrders   = orders.length > 0;
  const activeRound = orders.find(o => o.status==='active') || null;

  // ── Loading / error ───────────────────────────────────────────────────────
  if (booting) return (
    <div style={{ ...S.center('#18181b'), height:'100dvh', maxWidth:480, margin:'0 auto' }}>
      <style>{CSS}</style>
      <Spin size={28} color="#555" />
      <p style={{ color:'#555', fontSize:14, marginTop:16, fontFamily:FF }}>Loading menu…</p>
    </div>
  );

  if (error || !ctx) return (
    <div style={{ ...S.center('#18181b'), height:'100dvh', maxWidth:480, margin:'0 auto' }}>
      <style>{CSS}</style>
      <div style={{ textAlign:'center', padding:'0 40px' }}>
        {/* Icon */}
        <div style={{ width:64,height:64,borderRadius:18,background:'#1f1f23',border:'1px solid #3f3f46',
          display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px' }}>
          <svg width={28} height={28} fill="none" viewBox="0 0 24 24" stroke="#52525b" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM6.75 6.75h.75v.75h-.75V6.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75V6.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM16.5 13.5h1.5v1.5h-1.5v-1.5zM16.5 19.5h1.5v1.5h-1.5v-1.5zM19.5 13.5h.75v.75h-.75v-.75zM19.5 16.5h.75v.75h-.75v-.75z" />
          </svg>
        </div>
        <p style={{ color:'#e4e4e7',fontSize:20,fontWeight:700,margin:'0 0 10px',fontFamily:FF }}>
          Invalid QR Code
        </p>
        <p style={{ color:'#52525b',fontSize:14,lineHeight:1.7,fontFamily:FF }}>
          {error || 'This QR code is not valid or has expired. Please ask your waiter for a new one.'}
        </p>
      </div>
    </div>
  );

  // ── Session ended ─────────────────────────────────────────────────────────
  if (screen==='session_ended') return (
    <div style={{ ...S.page, background:'#18181b' }}>
      <style>{CSS}</style>
      <Header ctx={ctx} brand={brand} />
      <div style={S.center('transparent')}>
        <div style={{ textAlign:'center', padding:'0 32px' }}>
          <div style={{ width:56,height:56,borderRadius:16,background:'#16a34a18',border:'1.5px solid #16a34a30',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}>
            <IconCheck c="#16a34a" s={26} />
          </div>
          <p style={{ color:'#fff',fontSize:20,fontWeight:700,margin:'0 0 8px',fontFamily:FF }}>Thank you!</p>
          <p style={{ color:'#71717a',fontSize:14,lineHeight:1.6,fontFamily:FF }}>Your bill has been settled. Hope to see you again!</p>
          {ctx.bill_footer && <p style={{ color:'#3f3f46',fontSize:12,marginTop:20,fontFamily:FF }}>{ctx.bill_footer}</p>}
        </div>
      </div>
    </div>
  );

  // ── Bill requested ────────────────────────────────────────────────────────
  if (screen==='bill_requested') {
    const sub = ordersSub, tax = sub*taxPct, tot = sub+tax;
    const merged = mergeItems(orders);
    return (
      <div style={{ ...S.page, background:'#18181b' }}>
        <style>{CSS}</style>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
        <Header ctx={ctx} brand={brand} />
        <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 32px' }}>
          {/* Status banner */}
          <div style={{ display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,background:`${brand}12`,border:`1.5px solid ${brand}30`,marginBottom:16 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:`${brand}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <IconBell c={brand} s={18} />
            </div>
            <div>
              <p style={{ color:brand,fontSize:14,fontWeight:700,margin:'0 0 2px',fontFamily:FF }}>Bill Requested</p>
              <p style={{ color:'#71717a',fontSize:12,margin:0,fontFamily:FF }}>Your waiter will be with you shortly.</p>
            </div>
          </div>

          {/* Bill summary card */}
          <div style={{ background:'#1f1f23',borderRadius:14,border:'1px solid #2a2a2e',overflow:'hidden' }}>
            <div style={{ padding:'12px 16px',borderBottom:'1px solid #2a2a2e' }}>
              <p style={{ color:'#52525b',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',margin:0,fontFamily:FF }}>Bill Summary</p>
            </div>
            <div style={{ padding:'4px 16px' }}>
              {merged.map((it,i) => (
                <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'9px 0',borderBottom:i<merged.length-1?'1px solid #27272a':'none' }}>
                  <div style={{ flex:1 }}>
                    <span style={{ color:'#e4e4e7',fontSize:13,fontFamily:FF }}>
                      <span style={{ color:brand,fontWeight:700,fontFamily:FM }}>{it.quantity}×</span> {it.name}
                    </span>
                    {it.note && <p style={{ color:'#52525b',fontSize:11,fontStyle:'italic',margin:'2px 0 0',fontFamily:FF }}>{it.note}</p>}
                  </div>
                  <span style={{ color:'#71717a',fontSize:13,fontFamily:FM,marginLeft:16,flexShrink:0 }}>{sym}{(it.price*it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div style={{ padding:'12px 16px',borderTop:'1px solid #2a2a2e',background:'#18181b' }}>
              <Row label="Subtotal" val={`${sym}${sub.toFixed(2)}`} dim />
              <Row label={`Tax (${ctx.tax_percent}%)`} val={`${sym}${tax.toFixed(2)}`} dim />
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6 }}>
                <span style={{ color:'#fff',fontSize:15,fontWeight:700,fontFamily:FF }}>Total</span>
                <span style={{ color:brand,fontSize:20,fontWeight:800,fontFamily:FM }}>{sym}{tot.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {ctx.bill_footer && <p style={{ textAlign:'center',color:'#3f3f46',fontSize:12,lineHeight:1.5,fontFamily:FF,marginTop:16 }}>{ctx.bill_footer}</p>}
        </div>
      </div>
    );
  }

  // ── Ordered screen ────────────────────────────────────────────────────────
  if (screen==='ordered' && hasOrders && cart.length===0) {
    const sub=ordersSub, tax=sub*taxPct;
    return (
      <div style={{ ...S.page, background:'#18181b' }}>
        <style>{CSS}</style>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
        <Header ctx={ctx} brand={brand} />
        <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 32px' }}>
          {/* Status */}
          <div style={{ display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,
            background:activeRound?`${brand}12`:'#16a34a12',border:`1.5px solid ${activeRound?brand+'30':'#16a34a30'}`,marginBottom:16 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:activeRound?`${brand}20`:'#16a34a20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              {activeRound ? <IconChef c={brand} s={18}/> : <IconCheck c="#16a34a" s={18}/>}
            </div>
            <div>
              <p style={{ color:activeRound?brand:'#16a34a',fontSize:14,fontWeight:700,margin:'0 0 2px',fontFamily:FF }}>
                {activeRound ? 'Order in kitchen' : 'All items delivered'}
              </p>
              <p style={{ color:'#71717a',fontSize:12,margin:0,fontFamily:FF }}>
                {activeRound ? 'Your food is being prepared.' : 'Add more items or request the bill below.'}
              </p>
            </div>
          </div>

          {/* Order rounds */}
          {orders.map((ord,ri) => {
            const isAct = ord.status==='active';
            const rt    = ord.items.reduce((s,i)=>s+i.price*i.quantity,0);
            return (
              <div key={ord.id} style={{ background:'#1f1f23',borderRadius:14,border:'1px solid #2a2a2e',marginBottom:12,overflow:'hidden' }}>
                <div style={{ padding:'10px 14px',borderBottom:'1px solid #2a2a2e',display:'flex',justifyContent:'space-between',alignItems:'center',background:isAct?`${brand}10`:'#27272a28' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                    <span style={{ width:7,height:7,borderRadius:'50%',background:isAct?brand:'#16a34a',display:'inline-block',flexShrink:0 }}/>
                    <span style={{ color:isAct?brand:'#16a34a',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',fontFamily:FF }}>
                      {orders.length>1?`Round ${ri+1} — `:''}{isAct?'In Kitchen':'Delivered'}
                    </span>
                  </div>
                  <span style={{ color:'#52525b',fontSize:12,fontFamily:FM }}>{sym}{rt.toFixed(2)}</span>
                </div>
                <div style={{ padding:'4px 14px' }}>
                  {ord.items.map((it,i)=>(
                    <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:i<ord.items.length-1?'1px solid #27272a':'none' }}>
                      <div style={{ flex:1 }}>
                        <span style={{ color:'#e4e4e7',fontSize:13,fontFamily:FF }}>
                          <span style={{ color:brand,fontWeight:700,fontFamily:FM }}>{it.quantity}×</span> {it.name}
                        </span>
                        {it.note&&<p style={{ color:'#52525b',fontSize:11,fontStyle:'italic',margin:'2px 0 0',fontFamily:FF }}>{it.note}</p>}
                      </div>
                      <span style={{ color:'#52525b',fontSize:12,fontFamily:FM,marginLeft:16,flexShrink:0 }}>{sym}{(it.price*it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Running total */}
          <div style={{ background:'#1f1f23',border:'1px solid #2a2a2e',borderRadius:14,padding:'14px 16px',marginBottom:16 }}>
            <Row label="Subtotal" val={`${sym}${sub.toFixed(2)}`} dim />
            <Row label={`Tax (${ctx.tax_percent}%)`} val={`${sym}${tax.toFixed(2)}`} dim />
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6 }}>
              <span style={{ color:'#fff',fontSize:14,fontWeight:700,fontFamily:FF }}>Total so far</span>
              <span style={{ color:brand,fontSize:18,fontWeight:700,fontFamily:FM }}>{sym}{(sub*(1+taxPct)).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action strip */}
        <div style={{ padding:'12px 16px 28px',borderTop:'1px solid #27272a',background:'#18181b',display:'flex',flexDirection:'column',gap:10,flexShrink:0 }}>
          <Btn label="Add More Items" onClick={()=>setScreen('menu')} outline color={brand} />
          <Btn label="Request Bill" onClick={reqBill} busy={busy} color="#16a34a" bg="#16a34a12" border="#16a34a30" />
        </div>
      </div>
    );
  }

  // ── Menu + Cart ───────────────────────────────────────────────────────────
  // The cart is position:fixed so the menu layout is NEVER affected by it.
  // We only add bottom padding to the scroll container equal to the cart height.
  const cartBottomH = cartQty > 0 ? ((cartH || 44) + 8) : 0;

  return (
    <div style={{ ...S.page, background:'#18181b', position:'relative' }}>
      <style>{CSS}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Header ── */}
      <Header ctx={ctx} brand={brand} />

      {/* ── Category tabs ── */}
      <div style={{ flexShrink:0, display:'flex', gap:8, overflowX:'auto', padding:'10px 16px',
        borderBottom:'1px solid #27272a', scrollbarWidth:'none' }}>
        {cats.map(c => (
          <button key={c.id} onClick={()=>setCatId(c.id)} style={{
            flexShrink:0, padding:'6px 16px', borderRadius:99,
            border:`1.5px solid ${catId===c.id?brand:'#3f3f46'}`,
            background:catId===c.id?brand:'transparent',
            color:catId===c.id?'#fff':'#71717a',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FF,
            transition:'all .15s', whiteSpace:'nowrap',
          }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* ── Order status mini-bar ── */}
      {hasOrders && (
        <button onClick={()=>setScreen('ordered')} style={{
          width:'100%', padding:'9px 16px', background:`${brand}10`,
          border:'none', borderBottom:`1px solid ${brand}28`,
          display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', flexShrink:0,
        }}>
          <span style={{ color:brand, fontSize:12, fontWeight:600, fontFamily:FF }}>
            {activeRound ? 'Order in kitchen' : 'Order delivered'} — tap to view
          </span>
          <span style={{ color:brand, fontSize:12, fontFamily:FM, fontWeight:700 }}>
            {sym}{(ordersSub*(1+taxPct)).toFixed(2)}
          </span>
        </button>
      )}

      {/* ── Menu scroll area ─────────────────────────────────────────────────
           flex:1 + minHeight:0 makes this take all remaining vertical space.
           paddingBottom grows to match the cart panel height so nothing
           is hidden behind the fixed-position cart.
      ── */}
      <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:`12px 12px 0` }}>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10,
          paddingBottom: cartBottomH > 0 ? cartBottomH + 16 : 16,
        }}>
          {filtered.length === 0 && (
            <p style={{ gridColumn:'1/-1', textAlign:'center', color:'#3f3f46', padding:'40px 0', fontFamily:FF }}>
              No items in this category
            </p>
          )}
          {filtered.map(item => {
            const qty = cart.filter(c=>c.menu_item_id===item.id).reduce((s,c)=>s+c.quantity,0);
            return (
              <button key={item.id} onClick={()=>addItem(item)} style={{
                background:qty>0?`${brand}10`:'#1f1f23',
                border:`1.5px solid ${qty>0?brand+'45':'#2a2a2e'}`,
                borderRadius:12, overflow:'hidden', textAlign:'left',
                cursor:'pointer', padding:0, transition:'border-color .15s', position:'relative',
              }}>
                {/* Image area */}
                <div style={{ width:'100%', paddingTop:'62%', position:'relative', background:'#27272a' }}>
                  {item.image_path
                    ? <img src={`${API}${item.image_path}`} alt={item.name}
                        style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover' }} />
                    : <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <IconPhoto />
                      </div>
                  }
                  {qty > 0 && (
                    <div style={{ position:'absolute',top:7,right:7,background:brand,color:'#fff',
                      width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:11,fontWeight:700,fontFamily:FM }}>
                      {qty}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding:'9px 11px 11px' }}>
                  <p style={{ color:'#e4e4e7',fontSize:12,fontWeight:600,margin:'0 0 2px',lineHeight:1.3,fontFamily:FF }}>{item.name}</p>
                  {item.description && (
                    <p style={{ color:'#52525b',fontSize:10,margin:'0 0 5px',lineHeight:1.3,fontFamily:FF,
                      display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden' } as any}>
                      {item.description}
                    </p>
                  )}
                  <p style={{ color:brand,fontSize:13,fontWeight:700,margin:0,fontFamily:FM }}>
                    {sym}{parseFloat(String(item.price)).toFixed(2)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Request bill strip (no cart) ── */}
      {hasOrders && cartQty===0 && screen==='menu' && (
        <div style={{ padding:'10px 16px 24px',borderTop:'1px solid #27272a',flexShrink:0,background:'#18181b' }}>
          <Btn label="Request Bill" onClick={reqBill} busy={busy} color="#16a34a" bg="#16a34a12" border="#16a34a30" />
        </div>
      )}

      {/* ── Cart — COLLAPSIBLE PILL ───────────────────────────────────────────
           Collapsed (default): single bar showing qty badge + item names + total
           + Place Order button. Only 56px tall — takes almost no screen space.
           Expanded: shows full item list (capped at 160px scroll) + notes.
           User taps the pill bar to toggle. Auto-opens when item added.
      ── */}
      {cartQty > 0 && (
        <div ref={cartRef} style={{
          position:      'fixed',
          bottom:        0,
          left:          '50%',
          transform:     'translateX(-50%)',
          width:         '100%',
          maxWidth:      480,
          background:    '#1c1c20',
          borderTop:     `2px solid ${brand}`,
          boxShadow:     '0 -6px 32px rgba(0,0,0,.55)',
          zIndex:        200,
        }}>

          {/* ── Expanded item list — only visible when cartOpen ── */}
          {cartOpen && (
            <div style={{ maxHeight:160, overflowY:'auto', borderBottom:'1px solid #27272a' }}>
              {cart.map((item,idx) => (
                <div key={idx} style={{ padding:'8px 16px', borderBottom:'1px solid #27272a' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                      <button onClick={()=>setQty(idx,-1)} style={{
                        ...S.qBtn, borderColor:item.quantity===1?'#dc262640':'#3f3f46',
                      }}>
                        {item.quantity===1 ? <IconX c="#dc2626" s={9}/> : <IconMinus c="#71717a" s={9}/>}
                      </button>
                      <span style={{ color:'#fff',fontSize:12,fontWeight:700,fontFamily:FM,minWidth:16,textAlign:'center' }}>
                        {item.quantity}
                      </span>
                      <button onClick={()=>setQty(idx,1)} style={S.qBtn}>
                        <IconPlus c="#71717a" s={9}/>
                      </button>
                    </div>
                    <span style={{ flex:1,color:'#e4e4e7',fontSize:12,fontFamily:FF,lineHeight:1.3 }}>{item.name}</span>
                    <span style={{ color:'#52525b',fontSize:11,fontFamily:FM,flexShrink:0 }}>
                      {sym}{(item.price*item.quantity).toFixed(2)}
                    </span>
                  </div>
                  <input
                    placeholder="Note (optional)"
                    value={item.note}
                    onChange={e=>setNote(idx,e.target.value)}
                    style={{ marginTop:5,width:'100%',background:'#27272a',border:'1px solid #3f3f46',
                      borderRadius:7,color:'#e4e4e7',fontSize:11,padding:'4px 9px',
                      fontFamily:FF,boxSizing:'border-box' as any,outline:'none' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Pill bar — always visible, tap to toggle expanded ── */}
          <div style={{ display:'flex', alignItems:'center', gap:0, padding:'0 0 0 0' }}>

            {/* Left tap area — toggles expanded/collapsed */}
            <button
              onClick={() => setCartOpen(o => !o)}
              style={{
                flex:1, display:'flex', alignItems:'center', gap:10,
                padding:'10px 14px', background:'transparent', border:'none',
                cursor:'pointer', minWidth:0,
              }}
            >
              {/* Qty badge */}
              <span style={{
                background:brand, color:'#fff', borderRadius:99,
                minWidth:22, height:22, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:800, fontFamily:FM, padding:'0 6px', flexShrink:0,
              }}>{cartQty}</span>

              {/* Item names summary — truncated */}
              <span style={{
                color:'#a1a1aa', fontSize:12, fontFamily:FF,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
              }}>
                {cart.map(i => i.name).join(', ')}
              </span>

              {/* Chevron */}
              <span style={{
                color:'#52525b', fontSize:10, flexShrink:0,
                transform: cartOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition:'transform .2s',
                display:'inline-block',
              }}>▲</span>

              {/* Subtotal */}
              <span style={{
                color:brand, fontSize:14, fontWeight:800, fontFamily:FM, flexShrink:0,
              }}>{sym}{cartSub.toFixed(2)}</span>
            </button>

            {/* Right: Place Order CTA button */}
            <button onClick={placeOrder} disabled={busy} style={{
              flexShrink:0,
              height:44, padding:'0 18px',
              background:busy?'#3f3f46':brand, color:'#fff', border:'none',
              borderLeft:`1px solid rgba(0,0,0,.3)`,
              fontSize:13, fontWeight:800, cursor:busy?'not-allowed':'pointer', fontFamily:FF,
              display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap',
            }}>
              {busy
                ? <Spin size={14}/>
                : hasOrders ? 'Add to Order' : 'Place Order'
              }
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ ctx, brand }: { ctx: KioskCtx; brand: string }) {
  const subtitle = ctx.is_parcel
    ? 'Parcel / Takeaway'
    : `${ctx.table_label} \u2022 Dine in`;
  return (
    <div style={{ background:brand,padding:'13px 16px 12px',display:'flex',alignItems:'center',gap:12,flexShrink:0 }}>
      {ctx.logo_url && (
        <img src={`${API}${ctx.logo_url}`} alt="logo"
          style={{ width:36,height:36,borderRadius:9,objectFit:'cover',flexShrink:0 }} />
      )}
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ color:'#fff',fontSize:15,fontWeight:700,margin:0,fontFamily:FF,lineHeight:1.2 }}>
          {ctx.restaurant_name}
        </p>
        <p style={{ color:'rgba(255,255,255,.72)',fontSize:12,margin:'2px 0 0',fontFamily:FF }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeItems(orders: Order[]) {
  const m = new Map<string,{name:string;price:number;quantity:number;note:string}>();
  for (const o of orders)
    for (const it of o.items) {
      const k=`${it.name}||${it.note||''}||${it.price}`;
      const ex=m.get(k);
      if (ex) ex.quantity+=it.quantity;
      else m.set(k,{name:it.name,price:it.price,quantity:it.quantity,note:it.note||''});
    }
  return Array.from(m.values());
}

function Row({ label, val, dim=false }:{ label:string; val:string; dim?:boolean }) {
  return (
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
      <span style={{ color:dim?'#52525b':'#a1a1aa',fontSize:12,fontFamily:FF }}>{label}</span>
      <span style={{ color:dim?'#71717a':'#a1a1aa',fontSize:12,fontFamily:FM }}>{val}</span>
    </div>
  );
}

function Btn({ label, onClick, busy=false, outline=false, color, bg='transparent', border }: {
  label:string; onClick:()=>void; busy?:boolean; outline?:boolean; color:string; bg?:string; border?:string;
}) {
  return (
    <button onClick={onClick} disabled={busy} style={{
      width:'100%', padding:'13px', borderRadius:12,
      background:outline?'transparent':bg,
      border:`1.5px solid ${border||(outline?color+'50':'transparent')}`,
      color:color, fontSize:14, fontWeight:700, cursor:busy?'not-allowed':'pointer', fontFamily:FF,
      display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'opacity .15s',
    }}>
      {busy ? <Spin color={color} size={16}/> : label}
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    display:'flex' as const,
    flexDirection:'column' as const,
    height:'100dvh',
    overflow:'hidden',
    maxWidth:480,
    margin:'0 auto',
  },
  center: (bg:string) => ({
    display:'flex' as const,
    flexDirection:'column' as const,
    alignItems:'center' as const,
    justifyContent:'center' as const,
    flex:1,
    background:bg,
  }),
  qBtn: {
    width:28, height:28, borderRadius:8,
    background:'#27272a', border:'1px solid #3f3f46',
    display:'flex' as const, alignItems:'center' as const, justifyContent:'center' as const,
    cursor:'pointer', padding:0, flexShrink:0,
  },
};

const CSS = `
  @keyframes kspin { to { transform:rotate(360deg); } }
  @keyframes kIn   { from { opacity:0;transform:translateY(-6px); } to { opacity:1;transform:translateY(0); } }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  input { outline:none; }
  input::placeholder { color:#3f3f46; }
  button:active { opacity:.78; }
  ::-webkit-scrollbar { display:none; }
`;