/**
 * frontend/src/views/waiter/ParcelModal.tsx
 *
 * FIXES:
 * 1. QR now uses LAN IP (fetched from /api/kiosk/lan-ip) instead of
 *    window.location.origin (which is localhost and makes useless QR codes).
 * 2. No emojis.
 * 3. Cleaner layout — step 1 and step 2 are visually tighter.
 */

import React, { useState, useEffect } from 'react';
import { authedJson } from '../../utils/authedFetch';
import QrImage from '../../components/QrImage';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface ParcelSlot {
  id:          string;
  label:       string;
  kiosk_token: string;
  status:      string;
}

interface Props {
  onCreated: () => void;
  onClose:   () => void;
}

async function getToken(): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/token`);
    const d = await r.json();
    return d.token ?? null;
  } catch { return null; }
}

async function createParcelSlot(customerName: string): Promise<ParcelSlot> {
  const token = await getToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/parcel/slot`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ customer_name: customerName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create parcel slot');
  return data;
}

async function fetchLanIp(): Promise<string | null> {
  try {
    const d = await fetch(`${API_BASE}/api/kiosk/lan-ip`).then(r => r.json());
    return d.ip || null;
  } catch { return null; }
}

export default function ParcelModal({ onCreated, onClose }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [creating,     setCreating]     = useState(false);
  const [slot,         setSlot]         = useState<ParcelSlot | null>(null);
  const [error,        setError]        = useState('');
  const [copied,       setCopied]       = useState(false);
  const [lanIp,        setLanIp]        = useState<string | null>(null);

  // Fetch LAN IP on mount so QR URL is ready as soon as slot is created
  useEffect(() => { fetchLanIp().then(setLanIp); }, []);

  // Build kiosk URL using LAN IP when available
  const currentPort = window.location.port ? `:${window.location.port}` : '';
  const baseOrigin  = lanIp ? `http://${lanIp}${currentPort}` : window.location.origin;
  const kioskUrl    = slot ? `${baseOrigin}/kiosk/${slot.kiosk_token}` : null;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const s = await createParcelSlot(customerName);
      setSlot(s);
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = () => {
    if (!kioskUrl) return;
    navigator.clipboard.writeText(kioskUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={!slot ? onClose : undefined}
    >
      <div
        className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <h3 className="font-bold text-white text-sm">New Parcel Order</h3>
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Creates a parcel slot in the table list. Add items and bill normally.
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Step 1: create ── */}
        {!slot && (
          <>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">
                  Customer Name
                  <span className="text-zinc-600 font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Rahul, Walk-in 3…"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
                <p className="text-zinc-700 text-[10px] mt-1">
                  If blank, slot is named Parcel 1, Parcel 2, etc.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="rounded-lg bg-indigo-500/8 border border-indigo-500/20 px-3 py-2.5 text-[11px] text-zinc-500 space-y-0.5">
                <p className="text-indigo-400 font-semibold text-xs mb-1">What happens</p>
                <p>• Slot appears in the table list as P1, P2…</p>
                <p>• Add items, send to kitchen, generate bill as normal</p>
                <p>• Bill defaults to Parcel order type</p>
                <p>• Or share the QR so the customer orders themselves</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onClose}>Cancel</button>
              <button
                className="btn flex-1 bg-indigo-500 border-indigo-600 text-white hover:bg-indigo-600 disabled:opacity-40"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : 'Create Parcel Slot'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: created ── */}
        {slot && (
          <>
            {/* Success */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <div>
                <p className="text-emerald-400 text-xs font-semibold">{slot.label} created</p>
                <p className="text-zinc-500 text-[10px]">Select it in the table list to add items</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {/* Option A */}
              <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                <p className="text-zinc-300 text-xs font-semibold mb-1">Option A — Waiter takes the order</p>
                <p className="text-zinc-500 text-[11px] leading-relaxed">
                  Close this dialog. <span className="text-zinc-300 font-medium">{slot.label}</span> is now in the table list. Select it, add items, and bill as usual.
                </p>
              </div>

              {/* Option B */}
              <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                <p className="text-zinc-300 text-xs font-semibold mb-2">Option B — Customer scans QR to order</p>
                <div className="flex items-start gap-3">
                  {/* QR image — uses LAN IP, multi-provider fallback */}
                  <div className="bg-white p-1.5 rounded-lg flex-shrink-0">
                    {kioskUrl ? (
                      <QrImage url={kioskUrl} size={72} />
                    ) : (
                      <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 6 }}>
                        <span style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', fontFamily: 'system-ui,sans-serif', padding: 4 }}>Generating…</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-500 text-[11px] leading-relaxed mb-2">
                      Show this QR to the customer. They can browse the menu and order from their phone.
                    </p>
                    {lanIp && (
                      <p className="text-emerald-400 text-[10px] mb-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Uses {lanIp} — works on customer phones
                      </p>
                    )}
                    {!lanIp && (
                      <p className="text-amber-400 text-[10px] mb-2">No LAN IP — QR may only work on this PC</p>
                    )}
                    <button
                      onClick={copyUrl}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                    >
                      {copied ? (
                        <><svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-emerald-400">Copied</span></>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586" /></svg>Copy link</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button className="btn btn-brand w-full" onClick={onClose}>
              Done — go to table list
            </button>
          </>
        )}
      </div>
    </div>
  );
}