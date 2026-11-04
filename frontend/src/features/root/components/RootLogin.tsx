import { FormEvent, useState } from 'react';
import { errorMessage } from 'api/errors';
import Spinner from 'components/ui/feedback/Spinner';
import ThemeToggle from 'components/ui/base/ThemeToggle';
import { useBusy } from 'hooks/async/useBusy';

export default function RootLogin({ onLogin }: { onLogin: (phone: string, password: string) => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, run] = useBusy();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setError('');
    void run(async () => { try { await onLogin(phone, password); } catch (err) { setError(errorMessage(err, 'Login failed')); } });
  };
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-6 space-y-3">
        <div className="text-center mb-2"><h1 className="font-display font-bold text-xl text-white">Root console</h1><p className="text-zinc-500 text-xs mt-1">Platform administration</p></div>
        <div><label className="label" htmlFor="root-phone">Phone number</label><input id="root-phone" className="input" type="tel" autoComplete="username" value={phone} onChange={e => setPhone(e.target.value)} autoFocus /></div>
        <div><label className="label" htmlFor="root-pass">Password</label><input id="root-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <div role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
        <button type="submit" className="btn btn-brand w-full py-3" disabled={busy || !phone || !password}>{busy ? <Spinner /> : 'Sign in'}</button>
      </form>
    </div>
  );
}
