import Modal from './Modal';
import Icon from './Icon';
import Spinner from '../feedback/Spinner';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel }: Props) {
  const tone = danger ? 'bg-red-500/15 border border-red-500/25 text-red-400' : 'bg-brand-500/15 border border-brand-500/25 text-brand-400';
  return (
    <Modal title={title} onClose={onCancel} z={60}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
          <Icon name={danger ? 'warning' : 'alert'} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm leading-tight">{title}</h3>
          <p className="text-zinc-400 text-xs leading-relaxed mt-1">{message}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn flex-1 text-sm" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button type="button" className={`btn flex-1 text-sm ${danger ? 'btn-danger' : 'btn-brand'}`} onClick={onConfirm} disabled={busy}>
          {busy ? <Spinner /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
