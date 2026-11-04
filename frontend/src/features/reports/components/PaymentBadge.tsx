import Icon from 'components/ui/base/Icon';
import { METHOD_ICON } from 'features/billing/components/payment/PaymentMethodGrid';

const COLORS: Record<string, string> = { cash: '#10b981', upi: '#6366f1', card: '#3b82f6', cheque: '#f59e0b', split: '#a855f7' };
const NEUTRAL = '#71717a';
const label = (m: string): string => (m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1));

/** Coloured pill for a payment method. Unknown methods get a neutral pill with their own name. */
export default function PaymentBadge({ method }: { method: string | null }) {
  if (!method) return null;
  const key = method.toLowerCase();
  const color = COLORS[key] ?? NEUTRAL;
  const icon = METHOD_ICON[key];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, background: `${color}1a`, border: `1px solid ${color}40`, color, fontSize: 10, fontWeight: 700 }}>
      {icon && <Icon name={icon} className="w-2.5 h-2.5" />}{label(key)}
    </span>
  );
}
