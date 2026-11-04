import { MAX_PIN_LENGTH } from 'config/constants';
import { digitsOnly } from 'lib/input/input';

interface Props { pin: string; confirm: string; pinLabel: string; onPin: (v: string) => void; onConfirm: (v: string) => void; autoFocus?: boolean }

export default function PinFields({ pin, confirm, pinLabel, onPin, onConfirm, autoFocus }: Props) {
  return (
    <>
      <div><label className="label" htmlFor="pin-new">{pinLabel}</label>
        <input id="pin-new" className="input font-mono tracking-widest" type="password" inputMode="numeric" autoComplete="new-password" maxLength={MAX_PIN_LENGTH} placeholder="••••" value={pin} autoFocus={autoFocus} onChange={e => onPin(digitsOnly(e.target.value, MAX_PIN_LENGTH))} /></div>
      <div><label className="label" htmlFor="pin-confirm">Confirm PIN</label>
        <input id="pin-confirm" className="input font-mono tracking-widest" type="password" inputMode="numeric" autoComplete="new-password" maxLength={MAX_PIN_LENGTH} placeholder="••••" value={confirm} onChange={e => onConfirm(digitsOnly(e.target.value, MAX_PIN_LENGTH))} /></div>
    </>
  );
}
