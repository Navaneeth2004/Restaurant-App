import { formatMoney } from 'lib/format/money';
import { parseNumber } from 'lib/input/input';
import { quickAmounts } from 'lib/reports/payment';

interface Props { received: string; total: number; sym: string; showChange: boolean; change: number; onChange: (v: string) => void }

export default function AmountPaid({ received, total, sym, showChange, change, onChange }: Props) {
  const current = parseNumber(received);
  return (
    <div>
      <div className="bill-label">Amount Actually Paid</div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af' }}>{sym}</span>
        <input aria-label="Amount paid" className="bill-field bill-field-lg" type="number" min="0" step="0.50" placeholder={total.toFixed(2)} value={received} onChange={e => onChange(e.target.value)} />
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px' }}>Defaults to the bill total — edit if the customer paid a different amount.</p>
      <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 14 }}>
        {quickAmounts(total).map(a => (
          <button key={a} type="button" className="bill-chip" style={{ padding: '6px 12px', fontSize: 12 }} aria-pressed={current !== null && Math.abs(current - a) < 0.01} onClick={() => onChange(a.toFixed(2))}>{sym}{a.toFixed(0)}</button>
        ))}
      </div>
      {showChange && (
        <div className={`bill-box ${change > 0 ? 'bill-ok' : ''}`} style={{ marginBottom: 10 }}>
          <div><div className="bill-label" style={{ marginBottom: 2 }}>Change to return</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(change, sym)}</div></div>
        </div>
      )}
    </div>
  );
}
