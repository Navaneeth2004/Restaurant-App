import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import AmountPaid from 'features/billing/components/payment/AmountPaid';
import OrderTypeSwitch from 'features/billing/components/payment/OrderTypeSwitch';
import PaidSummary from 'features/billing/components/payment/PaidSummary';
import PaymentMethodGrid from 'features/billing/components/payment/PaymentMethodGrid';
import SplitEditor from 'features/billing/components/payment/SplitEditor';
import { LIMITS } from 'config/constants';
import { formatMoney } from 'lib/format/money';
import type { Visit } from 'lib/orders/visits';
import { useSettings } from 'state/settings/useSettings';
import { usePaymentEdit } from '../hooks/usePaymentEdit';

interface Props { visit: Visit; onClose: () => void; onSaved: () => void }

/** Edit the payment, order type, GSTIN and date of a closed visit. The same widgets as the bill's Payment tab. */
export default function PaymentEditModal({ visit, onClose, onSaved }: Props) {
  const settings = useSettings();
  const sym = settings.currency_symbol || '₹';
  const b2b = settings.b2b_enabled === 'true';
  const e = usePaymentEdit(visit, onSaved);
  const { form, patch, paid, change } = e.pay;
  const split = form.method === 'split';

  return (
    <Modal title="Edit payment" className="max-w-sm bill-sheet" padded={false} z={60}>
      <div className="bill-body"><div className="bill-pay">
        <div className="bill-box">
          <div><div className="bill-label" style={{ marginBottom: 2 }}>Edit payment</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Currently: <strong style={{ textTransform: 'capitalize' }}>{visit.paymentMethod ?? 'not recorded'}</strong>{visit.rateRecorded ? '' : ' · tax rate not recorded, current rate used'}</div></div>
          <div style={{ textAlign: 'right' }}><div className="bill-label" style={{ marginBottom: 2 }}>Bill</div><div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(visit.total, sym)}</div></div>
        </div>

        <div className="bill-label">Order date &amp; time</div>
        <div className="flex gap-2" style={{ marginBottom: 4 }}>
          <input aria-label="Order date" type="date" className="bill-field" value={e.start.date} onChange={ev => e.setStart(s => ({ ...s, date: ev.target.value }))} />
          <input aria-label="Order time" type="time" className="bill-field" value={e.start.time} onChange={ev => e.setStart(s => ({ ...s, time: ev.target.value }))} />
        </div>
        <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 16px' }}>Change this to log a visit that really happened earlier. Every round of the visit moves by the same amount.</p>

        <OrderTypeSwitch value={form.orderType} onChange={t => patch('orderType', t)} />
        <div className="bill-label">Payment Method</div>
        <PaymentMethodGrid value={form.method} onChange={m => patch('method', m)} />
        {split ? <SplitEditor splits={form.splits} sym={sym} onChange={s => patch('splits', s)} />
          : <AmountPaid received={form.received} total={visit.total} sym={sym} showChange={form.method === 'cash'} change={change} onChange={v => patch('received', v)} />}

        {b2b && (
          <div style={{ margin: '16px 0' }}>
            <div className="bill-label">Customer GSTIN <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#d1d5db' }}>— optional</span></div>
            <input aria-label="Customer GSTIN" className="bill-field" style={{ fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '.05em' }}
              placeholder="22AAAAA0000A1Z5" maxLength={LIMITS.gstin} value={form.customerGstin} onChange={ev => patch('customerGstin', ev.target.value.toUpperCase())} />
            {e.gstinError && <p role="alert" style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{e.gstinError}</p>}
            {e.clearedGstin && <p style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>A saved GSTIN cannot be removed here — leaving this empty keeps the current one.</p>}
          </div>
        )}
        <PaidSummary split={split} paid={paid} total={visit.total} sym={sym} />
      </div></div>
      <div className="bill-footer">
        <div className="flex gap-2">
          <button type="button" className="bill-btn" onClick={onClose} disabled={e.busy}>Cancel</button>
          <button type="button" className="bill-pay-btn" style={{ flex: 1, marginBottom: 0 }} onClick={() => void e.save()} disabled={!e.canSave}>{e.busy ? <><Spinner />Saving…</> : 'Save payment'}</button>
        </div>
      </div>
    </Modal>
  );
}
