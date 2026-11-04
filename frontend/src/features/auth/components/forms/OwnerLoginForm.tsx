import { FormEvent, useState } from 'react';
import { ownerLogin } from 'api/access/auth.api';
import { errorMessage } from 'api/errors';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import { useBusy } from 'hooks/async/useBusy';
import { BackLink, SubmitButton } from './FormBits';

interface Props { onDone: () => void; onBack: () => void }
interface Choice { id: string; name: string }

export default function OwnerLoginForm({ onDone, onBack }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, run] = useBusy();

  const login = (restaurantId?: string): void => {
    void run(async () => {
      setError(null);
      try {
        const r = await ownerLogin({ phone, password, restaurant_id: restaurantId });
        if (r.needs_restaurant) setChoices(r.restaurants);
        else onDone();
      } catch (e) { setError(e); }
    });
  };

  if (choices) {
    return (
      <div className="space-y-3">
        <p className="text-white text-sm font-semibold">Which restaurant is this device for?</p>
        {choices.map(c => <button key={c.id} type="button" className="btn w-full py-3" disabled={busy} onClick={() => login(c.id)}>{c.name}</button>)}
        <ErrorNotice error={error} />
      </div>
    );
  }

  const submit = (e: FormEvent): void => { e.preventDefault(); login(); };
  return (
    <form onSubmit={submit} className="space-y-3">
      <BackLink onBack={onBack} />
      <div>
        <label className="label" htmlFor="owner-phone">Phone number</label>
        <input id="owner-phone" className="input" type="tel" inputMode="tel" autoComplete="username" placeholder="98765 43210" value={phone} onChange={e => setPhone(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="owner-password">Password</label>
        <input id="owner-password" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      {error ? <p role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{errorMessage(error, 'Login failed')}</p> : null}
      <SubmitButton busy={busy} label="Log in & connect this device" disabled={!phone || !password} />
    </form>
  );
}
