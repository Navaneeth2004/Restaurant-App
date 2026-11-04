import Icon from 'components/ui/base/Icon';
import Modal from 'components/ui/base/Modal';
import BillHeader from 'features/billing/components/BillHeader';
import BillItems from 'features/billing/components/BillItems';
import { tableDisplayLabel } from 'lib/input/ids';
import { formatDate, formatTime } from 'lib/format/local-time';
import type { Visit } from 'lib/orders/visits';
import { useSettings } from 'state/settings/useSettings';

/**
 * Reprint of a closed bill. Items, tax rate and totals are the visit's own. The restaurant name, address and phone
 * are today's: the server does not store them per bill.
 */
export default function ReprintBill({ visit: v, onClose }: { visit: Visit; onClose: () => void }) {
  const s = useSettings();
  const sym = s.currency_symbol || '₹';
  return (
    <Modal title="Bill" className="max-w-sm bill-sheet bill-print-area" padded={false} onClose={onClose} z={70}>
      <BillHeader name={s.restaurant_name} address={s.address} phone={s.phone} logoUrl={s.logo_url} tableLabel={tableDisplayLabel(v.tableId)}
        dateStr={formatDate(v.startedAt, { day: '2-digit', month: 'short', year: 'numeric' })} timeStr={formatTime(v.startedAt)} />
      <div className="bill-body bill-items-wrapper">
        <BillItems items={v.items} totals={{ subtotal: v.subtotal, tax: v.tax, total: v.total }} sym={sym} taxPercent={v.rate} footer={s.bill_footer}
          customerGstin={v.customerGstin ?? undefined} customerName={v.customerName ?? undefined} customerPhone={v.customerPhone ?? undefined} />
      </div>
      <div className="bill-footer no-print">
        <div className="flex gap-2">
          <button type="button" className="bill-btn" onClick={() => window.print()}><Icon name="printer" className="w-4 h-4" />Print Bill</button>
          <button type="button" className="bill-btn" onClick={onClose}>Close</button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#aaa', margin: '6px 0 0' }}>For thermal printer: set paper size to <strong>58mm</strong></p>
      </div>
    </Modal>
  );
}
