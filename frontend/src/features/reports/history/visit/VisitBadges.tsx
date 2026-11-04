import { formatMoney } from 'lib/format/money';
import type { OrderType } from 'types/restaurant/orders';

const BASE = 'inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border whitespace-nowrap';

export function OrderTypeBadge({ type }: { type: OrderType }) {
  const parcel = type === 'parcel';
  return <span className={`${BASE} ${parcel ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40'}`}>{parcel ? 'Parcel' : 'Dine In'}</span>;
}

/** "Short ₹x" / "Over ₹x": paid vs the bill. */
export function DiffBadge({ diff, sym }: { diff: number; sym: string }) {
  const short = diff < 0;
  return <span className={`${BASE} ${short ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-blue-500/15 text-blue-400 border-blue-500/25'}`}>{short ? 'Short' : 'Over'} {formatMoney(Math.abs(diff), sym)}</span>;
}

export const Tag = ({ children, tone = 'zinc' }: { children: string; tone?: 'zinc' | 'brand' | 'amber' }) => {
  const c = tone === 'brand' ? 'bg-brand-500/15 text-brand-400 border-brand-500/25' : tone === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40';
  return <span className={`${BASE} ${c}`}>{children}</span>;
};
