import { formatMoney } from 'lib/format/money';
import { useSettings } from 'state/settings/useSettings';
import type { usePaymentForm } from '../../hooks/usePaymentForm';
import AmountPaid from './AmountPaid';
import CustomerFields from './CustomerFields';
import OrderTypeSwitch from './OrderTypeSwitch';
import PaidSummary from './PaidSummary';
import PaymentMethodGrid from './PaymentMethodGrid';
import SplitEditor from './SplitEditor';

interface Props { pay: ReturnType<typeof usePaymentForm>; total: number; sym: string; tableLabel: string; itemCount: number }

export default function PaymentTab({ pay, total, sym, tableLabel, itemCount }: Props) {
  const b2b = useSettings().b2b_enabled === 'true';
  const { form, patch, paid, change } = pay;
  const split = form.method === 'split';
  return (
    <div className="bill-pay">
      <div className="bill-box">
        <div><div className="bill-label" style={{ marginBottom: 2 }}>Bill Total</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand, #f97316)' }}>{formatMoney(total, sym)}</div></div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#6b7280' }}><div>{itemCount} items</div><div>{tableLabel}</div></div>
      </div>
      <OrderTypeSwitch value={form.orderType} onChange={t => patch('orderType', t)} />
      <CustomerFields form={form} b2b={b2b} onChange={patch} />
      <div className="bill-label">Payment Method</div>
      <PaymentMethodGrid value={form.method} onChange={m => patch('method', m)} />
      {split ? <SplitEditor splits={form.splits} sym={sym} onChange={s => patch('splits', s)} />
        : <AmountPaid received={form.received} total={total} sym={sym} showChange={form.method === 'cash'} change={change} onChange={v => patch('received', v)} />}
      <PaidSummary split={split} paid={paid} total={total} sym={sym} />
    </div>
  );
}
