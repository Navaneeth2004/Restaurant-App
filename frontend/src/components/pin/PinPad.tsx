import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { MIN_PIN_LENGTH } from 'config/constants';

interface Props {
  pin: string;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md';
  onDigit: (d: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function PinPad({ pin, loading = false, disabled = false, size = 'md', onDigit, onBack, onSubmit }: Props) {
  const lg = size === 'lg';
  const cell = `${lg ? 'h-14' : 'h-12'} rounded-xl border active:scale-95 transition-all duration-100 select-none`;
  const digit = `${cell} font-mono font-medium text-lg bg-surface-raised border-surface-border text-white hover:bg-zinc-600 disabled:opacity-50`;
  const off = loading || disabled;

  return (
    <div className={`grid grid-cols-3 ${lg ? 'gap-2.5' : 'gap-2'}`}>
      {DIGITS.map(d => <button key={d} type="button" className={digit} disabled={off} onClick={() => onDigit(d)}>{d}</button>)}
      <button type="button" aria-label="Delete" className={`${cell} bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 flex items-center justify-center`} disabled={off || pin.length === 0} onClick={onBack}>
        <Icon name="backspace" className="w-5 h-5" />
      </button>
      <button type="button" className={digit} disabled={off} onClick={() => onDigit('0')}>0</button>
      <button type="button" aria-label="Submit PIN" className={`${cell} bg-brand-500 border-brand-600 text-white hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center`} disabled={off || pin.length < MIN_PIN_LENGTH} onClick={onSubmit}>
        {loading ? <Spinner className="w-5 h-5 border-white/40 border-t-white" /> : <Icon name="check" className="w-5 h-5" strokeWidth={2.5} />}
      </button>
    </div>
  );
}
