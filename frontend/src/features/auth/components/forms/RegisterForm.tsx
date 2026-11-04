import { FormEvent, useState } from 'react';
import { ownerRegister } from 'api/access/auth.api';
import { errorMessage } from 'api/errors';
import { LIMITS, MAX_PIN_LENGTH } from 'config/constants';
import { digitsOnly } from 'lib/input/input';
import { useBusy } from 'hooks/async/useBusy';
import { BackLink, SubmitButton } from './FormBits';

interface Props { onDone: () => void; onBack: () => void }
const EMPTY = { restaurant_name: '', admin_name: '', phone: '', password: '', password2: '', admin_pin: '', admin_pin2: '' };

export default function RegisterForm({ onDone, onBack }: Props) {
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, run] = useBusy();
  const set = (k: keyof typeof EMPTY, v: string): void => setF(p => ({ ...p, [k]: v }));

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (f.password !== f.password2) { setError('Passwords do not match.'); return; }
    if (f.admin_pin !== f.admin_pin2) { setError('PINs do not match.'); return; }
    void run(async () => {
      setError('');
      try {
        await ownerRegister({ restaurant_name: f.restaurant_name, admin_name: f.admin_name, phone: f.phone, password: f.password, admin_pin: f.admin_pin });
        onDone();
      } catch (err) { setError(errorMessage(err, 'Could not create the account.')); }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <BackLink onBack={onBack} />
      <div><label className="label" htmlFor="r-name">Restaurant name</label>
        <input id="r-name" className="input" value={f.restaurant_name} onChange={e => set('restaurant_name', e.target.value)} maxLength={LIMITS.restaurantName} autoFocus /></div>
      <div><label className="label" htmlFor="r-admin">Your name</label>
        <input id="r-admin" className="input" value={f.admin_name} onChange={e => set('admin_name', e.target.value)} maxLength={40} /></div>
      <div><label className="label" htmlFor="r-phone">Phone number (your login)</label>
        <input id="r-phone" className="input" type="tel" inputMode="tel" autoComplete="username" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="r-pw">Password</label>
          <input id="r-pw" className="input" type="password" autoComplete="new-password" value={f.password} onChange={e => set('password', e.target.value)} /></div>
        <div><label className="label" htmlFor="r-pw2">Repeat</label>
          <input id="r-pw2" className="input" type="password" autoComplete="new-password" value={f.password2} onChange={e => set('password2', e.target.value)} /></div>
      </div>
      <p className="text-zinc-600 text-[10px] -mt-1">At least 8 characters. Used only by you, never by staff.</p>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="r-pin">Admin PIN</label>
          <input id="r-pin" className="input font-mono tracking-widest" type="password" inputMode="numeric" maxLength={MAX_PIN_LENGTH} value={f.admin_pin} onChange={e => set('admin_pin', digitsOnly(e.target.value, MAX_PIN_LENGTH))} /></div>
        <div><label className="label" htmlFor="r-pin2">Repeat PIN</label>
          <input id="r-pin2" className="input font-mono tracking-widest" type="password" inputMode="numeric" maxLength={MAX_PIN_LENGTH} value={f.admin_pin2} onChange={e => set('admin_pin2', digitsOnly(e.target.value, MAX_PIN_LENGTH))} /></div>
      </div>
      <p className="text-zinc-600 text-[10px] -mt-1">4–6 digits. This is what you type to open the app each day.</p>
      {error && <p role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</p>}
      <SubmitButton busy={busy} label="Create restaurant" />
    </form>
  );
}
