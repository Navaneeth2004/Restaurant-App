import { BillTotals } from 'lib/orders/bill';
import { formatMoney } from 'lib/format/money';

interface Props { totals: BillTotals; taxPercent: string; sym: string; label: string }

export default function TotalsCard({ totals, taxPercent, sym, label }: Props) {
  const row = (name: string, value: number) => (
    <div className="flex justify-between text-xs text-zinc-500 mb-1"><span>{name}</span><span className="font-mono">{formatMoney(value, sym)}</span></div>
  );
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5">
      {row('Subtotal', totals.subtotal)}
      {row(`Tax (${taxPercent}%)`, totals.tax)}
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-white text-sm font-bold">{label}</span>
        <span className="font-mono font-extrabold text-brand-400 text-lg">{formatMoney(totals.total, sym)}</span>
      </div>
    </div>
  );
}
