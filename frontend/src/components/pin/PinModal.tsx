import Icon from 'components/ui/base/Icon';
import Modal from 'components/ui/base/Modal';
import PinDots from './PinDots';
import PinPad from './PinPad';
import { usePinEntry } from './usePinEntry';

interface Props {
  title?: string;
  subtitle?: string;
  verify: (pin: string) => Promise<boolean>;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

export default function PinModal({ title = 'Admin PIN required', subtitle, verify, onSuccess, onCancel }: Props) {
  const entry = usePinEntry({ submit: verify, onAccepted: onSuccess });
  return (
    <Modal title={title} className="max-w-xs" z={80}>
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500/15 border border-brand-500/25 mb-3 text-brand-400">
          <Icon name="lock" className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
        {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="mb-5"><PinDots length={entry.pin.length} shake={entry.shake} /></div>
      {entry.error && <p role="alert" className="text-red-400 text-xs text-center mb-3">{entry.error}</p>}
      <PinPad pin={entry.pin} loading={entry.busy} disabled={entry.lockedFor > 0} onDigit={entry.digit} onBack={entry.back} onSubmit={entry.confirm} />
      <button type="button" onClick={onCancel} className="mt-3 w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1">Cancel</button>
    </Modal>
  );
}
