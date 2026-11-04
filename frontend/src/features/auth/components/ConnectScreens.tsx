import { useState } from 'react';
import { ROUTES } from 'config/routes';
import ConnectShell from './ConnectShell';
import OwnerLoginForm from './forms/OwnerLoginForm';
import PairForm from './forms/PairForm';
import RegisterForm from './forms/RegisterForm';

type Mode = 'choose' | 'owner' | 'register' | 'pair';
interface Props { registrationOpen: boolean; notice: string | null; onLinked: () => void }

export default function ConnectScreens({ registrationOpen, notice, onLinked }: Props) {
  const onPairPage = window.location.pathname === ROUTES.pair;
  const initialCode = new URLSearchParams(window.location.search).get('code') ?? '';
  const [mode, setMode] = useState<Mode>(onPairPage ? 'pair' : 'choose');

  const done = (): void => {
    if (window.location.pathname === ROUTES.pair) window.history.replaceState(null, '', '/');
    onLinked();
  };
  const back = (): void => setMode('choose');

  return (
    <ConnectShell notice={notice}>
      {mode === 'choose' && (
        <div className="space-y-3">
          <button type="button" className="btn btn-brand w-full py-3" onClick={() => setMode('owner')}>I'm the owner — log in</button>
          <button type="button" className="btn w-full py-3" onClick={() => setMode('pair')}>I'm staff — connect with a code</button>
          {registrationOpen && (
            <button type="button" className="w-full text-xs text-zinc-500 hover:text-white pt-2" onClick={() => setMode('register')}>New restaurant? Create an account</button>
          )}
          <p className="text-zinc-600 text-[11px] leading-relaxed pt-1">
            Staff: ask your manager for a 6-digit code (Admin → Devices). You will then sign in with your own PIN.
          </p>
        </div>
      )}
      {mode === 'owner' && <OwnerLoginForm onDone={done} onBack={back} />}
      {mode === 'register' && <RegisterForm onDone={done} onBack={back} />}
      {mode === 'pair' && <PairForm initialCode={initialCode} onDone={done} onBack={back} />}
    </ConnectShell>
  );
}
