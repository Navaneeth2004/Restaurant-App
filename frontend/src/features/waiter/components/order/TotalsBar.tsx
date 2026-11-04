import { formatMoney, sumLines } from 'lib/format/money';
import type { Rounds } from '../../hooks/rounds';

interface Props { rounds: Rounds; sym: string; cartTotal: number; hasCart: boolean; grandTotal: number }

export default function TotalsBar({ rounds, sym, cartTotal, hasCart, grandTotal }: Props) {
  const { direct, kitchen, active } = rounds;
  if (!hasCart && !active && kitchen.length === 0 && direct.length === 0) return null;
  const directTotal = sumLines(direct.flatMap(o => o.items));
  const row = (key: string, label: string, value: number, cls: string) => (
    <div key={key} className={`flex justify-between text-xs ${cls}`}><span>{label}</span><span className="font-mono">{formatMoney(value, sym)}</span></div>
  );
  return (
    <div className="border-t border-surface-border px-3 py-2 space-y-1 flex-shrink-0">
      {directTotal > 0 && row('direct', 'Billed directly', directTotal, 'text-zinc-600')}
      {kitchen.map((o, i) => row(o.id, kitchen.length > 1 ? `Round ${i + 1} (delivered)` : 'Delivered', sumLines(o.items), 'text-zinc-600'))}
      {active && row('active', kitchen.length > 0 ? `Round ${kitchen.length + 1} (in kitchen)` : 'In kitchen', sumLines(active.items), 'text-zinc-500')}
      {hasCart && row('cart', active ? 'Pending (unsent)' : 'New order (unsent)', cartTotal, 'text-zinc-400')}
      <div className="flex justify-between text-sm font-semibold text-white pt-1 border-t border-surface-border">
        <span>Total</span><span className="font-mono">{formatMoney(grandTotal, sym)}</span>
      </div>
    </div>
  );
}
