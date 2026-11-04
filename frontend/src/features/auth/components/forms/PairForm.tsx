import { FormEvent, useState } from 'react';
import { pairDevice } from 'api/access/auth.api';
import { errorMessage } from 'api/errors';
import { digitsOnly } from 'lib/input/input';
import { useBusy } from 'hooks/async/useBusy';
import { BackLink, SubmitButton } from './FormBits';

interface Props { initialCode: string; onDone: () => void; onBack: () => void }

export default function PairForm({ initialCode, onDone, onBack }: Props) {
  const [code, setCode] = useState(digitsOnly(initialCode, 6));
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, run] = useBusy();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      setError('');
      try { await pairDevice({ code, device_name: name || undefined }); onDone(); }
      catch (err) { setError(errorMessage(err, 'Could not connect.')); }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <BackLink onBack={onBack} />
      <div>
        <label className="label" htmlFor="pair-code">6-digit code</label>
        <input id="pair-code" className="input font-mono text-center text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={6} placeholder="••••••" value={code} onChange={e => setCode(digitsOnly(e.target.value, 6))} autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="pair-name">Name this device <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span></label>
        <input id="pair-name" className="input" placeholder="e.g. Ravi's phone" maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      </div>
      {error && <p role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</p>}
      <SubmitButton busy={busy} disabled={code.length !== 6} label="Connect" />
    </form>
  );
}
