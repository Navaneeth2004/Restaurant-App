import { useMemo, useState } from 'react';
import Icon from 'components/ui/base/Icon';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { billTotals, parseTaxPercent } from 'lib/orders/bill';
import { formatDate, formatTime } from 'lib/format/local-time';
import { formatMoney, sumLines } from 'lib/format/money';
import { countQuantity, mergeItems } from 'lib/orders/order-items';
import { useSettings } from 'state/settings/useSettings';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';
import { useCloseBill } from '../hooks/useCloseBill';
import { usePaymentForm } from '../hooks/usePaymentForm';
import { buildPaymentInput } from '../payment-input';
import BillHeader from './BillHeader';
import BillItems from './BillItems';
import BillWarnings, { Warning } from './BillWarnings';
import PaymentTab from './payment/PaymentTab';

interface Props { orders: ReadonlyArray<Order>; table: Table; onClose: () => void; onClosed: () => void }

/** The bill of one table visit. `orders` is a snapshot taken when the bill was opened, so it cannot shift while paying. */
export default function BillModal({ orders, table, onClose, onClosed }: Props) {
  const settings = useSettings();
  const sym = settings.currency_symbol || '₹';
  const taxPercent = parseTaxPercent(settings.tax_percent);
  const items = useMemo(() => mergeItems(orders.flatMap(o => o.items)), [orders]);
  const totals = useMemo(() => billTotals(sumLines(items), taxPercent), [items, taxPercent]);
  const opened = useState(() => new Date().toISOString())[0];

  const [tab, setTab] = useState<'bill' | 'payment'>('bill');
  const [visited, setVisited] = useState(false);
  const [warning, setWarning] = useState<Warning>(null);
  const pay = usePaymentForm(totals.total, { orderType: table.is_parcel ? 'parcel' : 'dine_in', customerName: table.customer_name ?? '', customerPhone: table.customer_phone ?? '' });
  const { busy, close } = useCloseBill(orders, onClosed);

  const showPayment = (): void => { setTab('payment'); setVisited(true); };
  const submit = (): void => { setWarning(null); void close(buildPaymentInput(pay.form, totals.total)); };
  const markPaid = (): void => {
    if (!visited) setWarning('no-method');
    else if (pay.bigShortfall) setWarning('short');
    else submit();
  };

  const gstin = pay.form.customerGstin.trim();
  return (
    <>
      <Modal title="Bill" className="max-w-sm bill-sheet bill-print-area" padded={false} onClose={onClose}>
        <BillHeader name={settings.restaurant_name} address={settings.address} phone={settings.phone} logoUrl={settings.logo_url}
          tableLabel={table.label} dateStr={formatDate(opened, { day: '2-digit', month: 'short', year: 'numeric' })} timeStr={formatTime(opened)} />
        <div className="bill-tabs no-print" role="tablist">
          <button type="button" role="tab" className="bill-tab" aria-selected={tab === 'bill'} onClick={() => setTab('bill')}>Bill</button>
          <button type="button" role="tab" className="bill-tab" aria-selected={tab === 'payment'} onClick={showPayment}>{visited ? 'Payment ✓' : 'Payment'}</button>
        </div>
        <div className="bill-body bill-items-wrapper" style={{ display: tab === 'bill' ? undefined : 'none' }}>
          <BillItems items={items} totals={totals} sym={sym} taxPercent={taxPercent} footer={settings.bill_footer}
            customerGstin={gstin || undefined} customerName={pay.form.customerName || undefined} customerPhone={pay.form.customerPhone || undefined} />
        </div>
        {tab === 'payment' && (
          <div className="bill-body payment-tab-print-hide">
            <PaymentTab pay={pay} total={totals.total} sym={sym} tableLabel={table.label} itemCount={countQuantity(items)} />
          </div>
        )}
        <div className="bill-footer no-print">
          <button type="button" className="bill-pay-btn" onClick={markPaid} disabled={busy}>
            {busy ? <><Spinner />Processing…</> : <><Icon name="check" className="w-[18px] h-[18px]" strokeWidth={2.5} />Mark Paid &nbsp;·&nbsp; {formatMoney(pay.paid, sym)}</>}
          </button>
          <div className="flex gap-2">
            <button type="button" className="bill-btn" onClick={() => window.print()}><Icon name="printer" className="w-4 h-4" />Print Bill</button>
            <button type="button" className="bill-btn" onClick={onClose} disabled={busy}>Close</button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#aaa', margin: '6px 0 0' }}>For thermal printer: set paper size to <strong>58mm</strong> (80mm: see print.css)</p>
        </div>
      </Modal>
      <BillWarnings warning={warning} busy={busy} sym={sym} total={totals.total} paid={pay.paid} split={pay.form.method === 'split'}
        onAddDetails={() => { setWarning(null); showPayment(); }} onPayDefault={submit} onPayAnyway={submit} onDismiss={() => setWarning(null)} />
    </>
  );
}
