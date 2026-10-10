/**
 * views/admin/AdminDevices.tsx
 *
 * Admin → Devices. Shows every phone/computer linked to this restaurant, lets an admin
 * add a new one with a one-time 6-digit code (valid 10 minutes), and remove a device
 * instantly (lost phone, staff who left).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { authedJson } from '../../utils/authedFetch';
import { useToast } from '../../context/ToastContext';
import { useAdminLock } from '../../context/AdminLockContext';
import ConfirmModal from '../../components/ConfirmModal';
import QrImage from '../../components/QrImage';

const API = process.env.REACT_APP_API_URL || window.location.origin;

interface Device {
  id: string; name: string; role_lock: string | null; created_via: string | null;
  created_at: string; last_seen_at: string | null; last_ip: string | null; is_current: boolean;
}
interface Pairing { code: string; expires_at: string; pair_url: string; role_lock: string | null }

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ROLE_OPTIONS = [
  { key: '',        label: 'Any staff',    hint: 'Waiters, kitchen and admins can all log in' },
  { key: 'waiter',  label: 'Waiter only',  hint: 'Only waiter and admin PINs work' },
  { key: 'kitchen', label: 'Kitchen only', hint: 'Only kitchen and admin PINs work' },
];

export default function AdminDevices() {
  const toast = useToast();
  const { requirePin, config: lockConfig } = useAdminLock();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirm, setConfirm] = useState<Device | null>(null);

  const load = useCallback(async () => {
    try { setDevices(await authedJson<Device[]>(`${API}/api/auth/devices`)); }
    catch (e: any) { toast(e.message || 'Could not load devices', 'error'); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // countdown + refresh the list when the code is used/expires
  useEffect(() => {
    if (!pairing) return;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(pairing.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) setPairing(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    const poll = setInterval(load, 5000);
    return () => { clearInterval(id); clearInterval(poll); };
  }, [pairing, load]);

  const createCode = async () => {
    setCreating(true);
    try {
      setPairing(await authedJson<Pairing>(`${API}/api/auth/pairing-code`, {
        method: 'POST', body: JSON.stringify({ role_lock: role || null }),
      }));
    } catch (e: any) { toast(e.message || 'Could not create a code', 'error'); }
    finally { setCreating(false); }
  };
  const guardedCreate = () => {
    if (!lockConfig.enabled) { createCode(); return; }
    requirePin(createCode, 'Add a device', 'Enter admin PIN to create a pairing code');
  };

  const revoke = async (d: Device) => {
    setConfirm(null);
    try {
      await authedJson(`${API}/api/auth/devices/${d.id}`, { method: 'DELETE' });
      toast(d.is_current ? 'This device was removed' : 'Device removed', 'success');
      if (d.is_current) window.dispatchEvent(new Event('pos-device-lost'));
      else load();
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="font-bold text-white text-sm">Linked devices</h3>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Only linked devices can open this restaurant, and every person still signs in with their own PIN.
          To add a staff phone, create a code here and type it on that phone (or scan the QR). Remove a device
          the moment it is lost or someone leaves.
        </p>
      </div>

      {/* Add a device */}
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest mb-3">Add a device</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {ROLE_OPTIONS.map(o => (
            <button key={o.key} onClick={() => setRole(o.key)}
              className={`text-left p-3 rounded-lg border transition-all ${
                role === o.key ? 'bg-brand-500/10 border-brand-500/50' : 'border-surface-border hover:border-zinc-600'
              }`}>
              <p className={`text-xs font-bold ${role === o.key ? 'text-brand-400' : 'text-white'}`}>{o.label}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug">{o.hint}</p>
            </button>
          ))}
        </div>
        <button className="btn btn-brand" onClick={guardedCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create pairing code'}
        </button>

        {pairing && (
          <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="bg-white p-2.5 rounded-xl flex-shrink-0">
              <QrImage url={pairing.pair_url} size={150} />
            </div>
            <div className="text-center sm:text-left min-w-0">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Code</p>
              <p className="font-mono font-bold text-white text-4xl tracking-[0.25em] leading-tight">{pairing.code}</p>
              <p className="text-zinc-400 text-xs mt-1">
                Expires in <span className="font-mono text-white">{mm}:{ss}</span> · works once
              </p>
              <p className="text-zinc-600 text-[11px] mt-2 leading-relaxed">
                On the new device open this site, choose “I'm staff — connect with a code”, and type the code —
                or scan the QR with the phone camera.
              </p>
              <button className="btn btn-sm mt-3" onClick={() => {
                navigator.clipboard.writeText(pairing.pair_url).then(() => toast('Link copied', 'success'));
              }}>Copy link</button>
            </div>
          </div>
        )}
      </div>

      {/* Device list */}
      <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest">
            {devices ? `${devices.length} device${devices.length !== 1 ? 's' : ''}` : 'Devices'}
          </h4>
          <button className="btn btn-sm" onClick={load}>Refresh</button>
        </div>
        {devices === null && <p className="px-4 py-6 text-zinc-600 text-xs">Loading…</p>}
        <div className="divide-y divide-surface-border">
          {devices?.map(d => (
            <div key={d.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white text-sm font-semibold truncate">{d.name}</span>
                  {d.is_current && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">This device</span>
                  )}
                  {d.role_lock && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">{d.role_lock} only</span>
                  )}
                </div>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  Last used {timeAgo(d.last_seen_at)} · added {timeAgo(d.created_at)}
                  {d.created_via === 'pairing' ? ' with a code' : d.created_via ? ' by owner login' : ''}
                </p>
              </div>
              <button
                onClick={() => setConfirm(d)}
                className="text-xs font-semibold text-red-400/80 hover:text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.is_current ? 'Remove THIS device?' : 'Remove this device?'}
          message={confirm.is_current
            ? 'You will be disconnected and will need the owner password or a pairing code to connect again.'
            : `“${confirm.name}” is disconnected immediately and will need a new pairing code to get back in.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => revoke(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}