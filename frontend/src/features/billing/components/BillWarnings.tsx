import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import Icon from 'components/ui/base/Icon';
import Modal from 'components/ui/base/Modal';
import { formatMoney } from 'lib/format/money';

export type Warning = 'no-method' | 'short' | null;

interface Props {
  warning: Warning; busy: boolean; sym: string; total: number; paid: number; split: boolean;
  onAddDetails: () => void; onPayDefault: () => void; onPayAnyway: () => void; onDismiss: () => void;
}

export default function BillWarnings({ warning, busy, sym, total, paid, split, onAddDetails, onPayDefault, onPayAnyway, onDismiss }: Props) {
  if (warning === 'no-method') {
    return (
      <Modal title="No payment method selected" z={60} onClose={onDismiss}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 text-amber-400"><Icon name="warning" className="w-5 h-5" /></div>
          <div>
            <h3 className="font-bold text-white text-sm">No payment method selected</h3>
            <p className="text-zinc-400 text-xs leading-relaxed mt-1">You haven't chosen a payment method yet. Would you like to add payment details, or mark as paid with default (cash)?</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-brand w-full text-sm" onClick={onAddDetails}>Add payment details</button>
          <button type="button" className="btn w-full text-sm" onClick={onPayDefault} disabled={busy}>Mark paid (cash)</button>
          <button type="button" className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors py-1" onClick={onDismiss}>Go back</button>
        </div>
      </Modal>
    );
  }
  if (warning === 'short') {
    const what = split ? `The split total (${formatMoney(paid, sym)})` : `The amount paid (${formatMoney(paid, sym)})`;
    return (
      <ConfirmDialog title="Large Payment Difference" danger confirmLabel="Mark Paid Anyway" cancelLabel="Go Back" busy={busy}
        message={`${what} is ${formatMoney(total - paid, sym)} less than the bill (${formatMoney(total, sym)}). Proceed?`}
        onConfirm={onPayAnyway} onCancel={onDismiss} />
    );
  }
  return null;
}
