/**
 * components/DeviceGate.tsx
 *
 * Barrier 1. Nothing in the app is shown until this browser is linked to a restaurant:
 *   - Owner:  log in with phone + password (or create an account) -> device is linked
 *   - Staff:  type the 6-digit code an admin generated (Admin -> Devices) -> device is linked
 * Once linked, the app opens straight to the PIN screen (barrier 2) — staff never see the
 * owner's phone number or password.
 */
import React, { useCallback, useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';

const API = process.env.REACT_APP_API_URL || window.location.origin;

interface Status {
  linked: boolean;
  suspended?: boolean;
  registration_open?: boolean;
  restaurant?: { name: string; brand_color?: string; logo_url?: string };
}
type Mode = 'choose' | 'owner' | 'register' | 'pair';

async function call(path: string, method = 'GET', body?: object) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data as any };
  } catch {
    return { ok: false, status: 0, data: { error: 'Cannot reach the server. Check your internet connection.' } as any };
  }
}

export default function DeviceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    const r = await call('/api/auth/device/status');
    if (r.ok) { setStatus(r.data); setOffline(false); }
    else if (r.status === 0) setOffline(true);        // keep the app up if the network blips
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    const onLost = () => setStatus(s => ({ linked: false, registration_open: s?.registration_open ?? true }));
    window.addEventListener('focus', onFocus);
    window.addEventListener('pos-device-lost', onLost);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pos-device-lost', onLost);
    };
  }, [refresh]);

  if (status === null) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        {offline ? (
          <>
            <p className="text-zinc-400 text-sm">Cannot reach the server.</p>
            <button className="btn btn-brand" onClick={refresh}>Try again</button>
          </>
        ) : (
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand-500 rounded-full animate-spin" />
        )}
      </div>
    );
  }
  if (status.linked) return <>{children}</>;
  return <ConnectScreens registrationOpen={status.registration_open !== false} suspended={!!status.suspended} onLinked={refresh} />;
}

// ─────────────────────────────────────────────────────────────────────────

function ConnectScreens({ registrationOpen, suspended, onLinked }: {
  registrationOpen: boolean; suspended: boolean; onLinked: () => void;
}) {
  const onPairPage = window.location.pathname === '/pair';
  const initialCode = new URLSearchParams(window.location.search).get('code') || '';
  const [mode, setMode] = useState<Mode>(onPairPage ? 'pair' : 'choose');

  const done = () => {
    if (window.location.pathname === '/pair') window.history.replaceState(null, '', '/');
    onLinked();
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-20"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <h1 className="font-display font-bold text-2xl text-white tracking-tight">Restaurant POS</h1>
          <p className="text-zinc-500 text-sm mt-1">Connect this device to your restaurant</p>
        </div>

        {suspended && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
            This restaurant account is not active. Please contact support.
          </div>
        )}

        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
          {mode === 'choose' && (
            <div className="space-y-3">
              <button className="btn btn-brand w-full py-3" onClick={() => setMode('owner')}>
                I'm the owner — log in
              </button>
              <button className="btn w-full py-3" onClick={() => setMode('pair')}>
                I'm staff — connect with a code
              </button>
              {registrationOpen && (
                <button className="w-full text-xs text-zinc-500 hover:text-white pt-2" onClick={() => setMode('register')}>
                  New restaurant? Create an account
                </button>
              )}
              <p className="text-zinc-600 text-[11px] leading-relaxed pt-1">
                Staff: ask your manager for a 6-digit code (Admin → Devices). You will then sign in with your own PIN.
              </p>
            </div>
          )}
          {mode === 'owner'    && <OwnerLogin onDone={done} onBack={() => setMode('choose')} />}
          {mode === 'register' && <Register onDone={done} onBack={() => setMode('choose')} />}
          {mode === 'pair'     && <Pair initialCode={initialCode} onDone={done} onBack={() => setMode('choose')} />}
        </div>
      </div>
    </div>
  );
}

function Back({ onBack }: { onBack: () => void }) {
  return <button type="button" onClick={onBack} className="text-xs text-zinc-500 hover:text-white mb-4">← Back</button>;
}
function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{msg}</div>;
}
function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button type="submit" className="btn btn-brand w-full py-3" disabled={busy}>
      {busy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : label}
    </button>
  );
}

function OwnerLogin({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [choices, setChoices] = useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login = async (restaurantId?: string) => {
    setBusy(true); setError('');
    const r = await call('/api/auth/owner/login', 'POST', { phone, password, method: 'password', restaurant_id: restaurantId });
    setBusy(false);
    if (!r.ok) { setError(r.data.error || 'Login failed'); return; }
    if (r.data.needs_restaurant) { setChoices(r.data.restaurants); return; }
    onDone();
  };

  if (choices) {
    return (
      <div className="space-y-3">
        <p className="text-white text-sm font-semibold">Which restaurant is this device for?</p>
        {choices.map(c => (
          <button key={c.id} className="btn w-full py-3" disabled={busy} onClick={() => login(c.id)}>{c.name}</button>
        ))}
        <ErrorBox msg={error} />
      </div>
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); login(); }} className="space-y-3">
      <Back onBack={onBack} />
      <div>
        <label className="label">Phone number</label>
        <input className="input" type="tel" inputMode="tel" autoComplete="username" placeholder="98765 43210"
          value={phone} onChange={e => setPhone(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <ErrorBox msg={error} />
      <Submit busy={busy} label="Log in & connect this device" />
    </form>
  );
}

function Register({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [f, setF] = useState({ restaurant_name: '', admin_name: '', phone: '', password: '', password2: '', admin_pin: '', admin_pin2: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) { setError('Passwords do not match.'); return; }
    if (f.admin_pin !== f.admin_pin2) { setError('PINs do not match.'); return; }
    setBusy(true); setError('');
    const r = await call('/api/auth/owner/register', 'POST', {
      restaurant_name: f.restaurant_name, admin_name: f.admin_name, phone: f.phone,
      password: f.password, admin_pin: f.admin_pin,
    });
    setBusy(false);
    if (!r.ok) { setError(r.data.error || 'Could not create the account.'); return; }
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Back onBack={onBack} />
      <div><label className="label">Restaurant name</label>
        <input className="input" value={f.restaurant_name} onChange={e => set('restaurant_name', e.target.value)} maxLength={60} autoFocus /></div>
      <div><label className="label">Your name</label>
        <input className="input" value={f.admin_name} onChange={e => set('admin_name', e.target.value)} maxLength={40} /></div>
      <div><label className="label">Phone number (your login)</label>
        <input className="input" type="tel" inputMode="tel" autoComplete="username" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Password</label>
          <input className="input" type="password" autoComplete="new-password" value={f.password} onChange={e => set('password', e.target.value)} /></div>
        <div><label className="label">Repeat</label>
          <input className="input" type="password" autoComplete="new-password" value={f.password2} onChange={e => set('password2', e.target.value)} /></div>
      </div>
      <p className="text-zinc-600 text-[10px] -mt-1">At least 8 characters. Used only by you, never by staff.</p>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Admin PIN</label>
          <input className="input font-mono tracking-widest" type="password" inputMode="numeric" maxLength={6}
            value={f.admin_pin} onChange={e => set('admin_pin', e.target.value.replace(/\D/g, ''))} /></div>
        <div><label className="label">Repeat PIN</label>
          <input className="input font-mono tracking-widest" type="password" inputMode="numeric" maxLength={6}
            value={f.admin_pin2} onChange={e => set('admin_pin2', e.target.value.replace(/\D/g, ''))} /></div>
      </div>
      <p className="text-zinc-600 text-[10px] -mt-1">4–6 digits. This is what you type to open the app each day.</p>
      <ErrorBox msg={error} />
      <Submit busy={busy} label="Create restaurant" />
    </form>
  );
}

function Pair({ initialCode, onDone, onBack }: { initialCode: string; onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, '').slice(0, 6));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await call('/api/auth/device/pair', 'POST', { code, device_name: name });
    setBusy(false);
    if (!r.ok) { setError(r.data.error || 'Could not connect.'); return; }
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Back onBack={onBack} />
      <div>
        <label className="label">6-digit code</label>
        <input className="input font-mono text-center text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={6} placeholder="••••••"
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
      </div>
      <div>
        <label className="label">Name this device <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span></label>
        <input className="input" placeholder="e.g. Ravi's phone" maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      </div>
      <ErrorBox msg={error} />
      <Submit busy={busy || code.length !== 6} label="Connect" />
    </form>
  );
}