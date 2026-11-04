import { formatMoney } from 'lib/format/money';
import type { MergedItem } from 'lib/orders/order-items';
import type { BillTotals } from 'lib/orders/bill';

interface Props {
  items: ReadonlyArray<MergedItem>; totals: BillTotals; sym: string; taxPercent: number; footer?: string;
  customerGstin?: string; customerName?: string; customerPhone?: string;
}

export default function BillItems({ items, totals, sym, taxPercent, footer, customerGstin, customerName, customerPhone }: Props) {
  return (
    <div className="bill-items-area">
      {customerGstin && (
        <div className="bill-gstin-box">
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6366f1' }}>B2B Tax Invoice</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>GSTIN: {customerGstin}</div>
          {customerName && <div>{customerName}{customerPhone ? ` · ${customerPhone}` : ''}</div>}
        </div>
      )}
      <table className="bill-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={`${it.name}|${it.note}|${it.price}`}>
              <td><div>{it.name}</div>{it.note && <div className="bill-note">{it.note}</div>}</td>
              <td>{it.quantity}</td>
              <td>{formatMoney(it.price, sym)}</td>
              <td style={{ color: '#111827', fontWeight: 600 }}>{formatMoney(it.price * it.quantity, sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bill-totals">
        <div className="bill-line"><span>Subtotal</span><span>{formatMoney(totals.subtotal, sym)}</span></div>
        <div className="bill-line">
          <span>GST ({taxPercent}%){customerGstin && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>CGST {taxPercent / 2}% + SGST {taxPercent / 2}%</span>}</span>
          <span>{formatMoney(totals.tax, sym)}</span>
        </div>
        <div className="bill-grand"><span>Total</span><span>{formatMoney(totals.total, sym)}</span></div>
      </div>
      {footer && <p className="bill-footer-text">{footer}</p>}
      {customerGstin && <p className="bill-footer-text" style={{ border: 'none', marginTop: 0, fontSize: 9 }}>Tax Invoice issued under GST · SAC applicable</p>}
    </div>
  );
}
