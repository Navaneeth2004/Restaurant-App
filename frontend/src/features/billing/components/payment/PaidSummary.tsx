import { formatMoney } from 'lib/format/money';
import { round2 } from 'lib/format/money';

interface Props { split: boolean; paid: number; total: number; sym: string }

export default function PaidSummary({ split, paid, total, sym }: Props) {
  const diff = round2(paid - total);
  const exact = Math.abs(diff) < 0.01;
  const tone = exact ? 'bill-ok' : diff < 0 ? 'bill-bad' : 'bill-over';
  return (
    <div className={`bill-box ${tone}`} style={{ display: 'block', marginBottom: 0, padding: '10px 14px', borderRadius: 10 }}>
      <div className="flex justify-between" style={{ fontSize: 13 }}><span style={{ color: '#374151', fontWeight: 500 }}>{split ? 'Split total' : 'Amount paid'}</span><strong>{formatMoney(paid, sym)}</strong></div>
      {exact
        ? <div style={{ fontSize: 11, marginTop: 2 }}>✓ Matches bill exactly</div>
        : <div className="flex justify-between" style={{ fontSize: 12, marginTop: 4 }}><span>{diff < 0 ? 'Less than bill (discount/short)' : 'More than bill (overpaid/tip)'}</span><strong>{diff < 0 ? '-' : '+'}{formatMoney(Math.abs(diff), sym)}</strong></div>}
    </div>
  );
}
