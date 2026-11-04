import Icon, { IconName } from 'components/ui/base/Icon';
import { PAYMENT_METHODS } from 'config/payment';

export const METHOD_ICON: Record<string, IconName> = { cash: 'cash', upi: 'phone', card: 'card', cheque: 'cheque', split: 'split' };

export default function PaymentMethodGrid({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {PAYMENT_METHODS.map(m => (
        <button key={m.key} type="button" className="bill-chip" aria-pressed={value === m.key} onClick={() => onChange(m.key)}>
          <Icon name={METHOD_ICON[m.key] ?? 'cash'} className="w-4 h-4" strokeWidth={1.8} />{m.label}
        </button>
      ))}
    </div>
  );
}
