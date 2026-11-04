import { STAFF_SESSION_DAYS } from 'config/constants';
import { API_ORIGIN } from 'config/env';
import PinDots from 'components/pin/PinDots';
import PinPad from 'components/pin/PinPad';
import { usePinEntry } from 'components/pin/usePinEntry';
import Icon from 'components/ui/base/Icon';
import ThemeToggle from 'components/ui/base/ThemeToggle';
import { useSettings } from 'state/settings/useSettings';
import { useAuth } from 'state/auth/useAuth';
import { useStaffLogin } from '../hooks/useStaffLogin';
import SwitchRestaurant from './SwitchRestaurant';

const noop = (): void => undefined;

export default function LoginScreen() {
  const settings = useSettings();
  const { sessionEnded, sessionEndReason, dismissSessionEnded } = useAuth();
  const entry = usePinEntry({ submit: useStaffLogin(), onAccepted: noop });

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-20"><ThemeToggle /></div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          {settings.logo_url && (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden shadow-xl shadow-brand-500/30">
              <img src={`${API_ORIGIN}${settings.logo_url}`} alt="Restaurant logo" className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="font-display font-bold text-2xl text-white tracking-tight">{settings.restaurant_name}</h1>
          <p className="text-zinc-500 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        {sessionEnded && (
          <div role="status" className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-slide-up">
            <Icon name="lock" className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 text-xs font-semibold">You were signed out</p>
              <p className="text-amber-400/70 text-xs mt-0.5">{sessionEndReason === 'expired'
                ? `Sessions last ${STAFF_SESSION_DAYS} days, and yours has run out. Enter your PIN to sign in again.`
                : 'This usually means you signed in on another device, or an admin changed your PIN or account. Enter your PIN to continue.'}</p>
            </div>
            <button type="button" aria-label="Dismiss" onClick={dismissSessionEnded} className="text-amber-400/50 hover:text-amber-400"><Icon name="x" className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
          </div>
        )}

        <div className="card p-6">
          <div className="mb-6"><PinDots length={entry.pin.length} shake={entry.shake} /></div>
          {entry.error && <p role="alert" className="text-red-400 text-xs text-center mb-3">{entry.error}</p>}
          <PinPad pin={entry.pin} loading={entry.busy} disabled={entry.lockedFor > 0} size="lg" onDigit={entry.digit} onBack={entry.back} onSubmit={entry.confirm} />
        </div>

        <p className="text-center text-zinc-700 text-xs mt-5">Contact your manager if you've forgotten your PIN</p>
        <SwitchRestaurant />
      </div>
    </div>
  );
}
