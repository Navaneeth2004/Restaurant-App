import Icon from 'components/ui/base/Icon';
import { formatMoney } from 'lib/format/money';

interface Props {
  search: string; onSearch: (v: string) => void; count: number; of: number; total: number; sym: string; rangeLabel: string;
}

/** Search-within-results box plus the visit count and the total of what is shown (bill totals incl. tax). */
export default function ResultsBar({ search, onSearch, count, of, total, sym, rangeLabel }: Props) {
  const filtering = search.trim().length > 0;
  return (
    <div className="mb-4 p-3 rounded-xl bg-surface-card/60 border border-surface-border space-y-2.5">
      <div className="relative">
        <Icon name="search" className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input type="search" aria-label="Search visits" className="input h-10 w-full pl-9 pr-3 bg-surface-raised" placeholder="Search by name, phone, GSTIN, item, or amount…" value={search} onChange={e => onSearch(e.target.value)} />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {count > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-xs font-semibold text-zinc-300 bg-surface-raised border border-surface-border px-2.5 py-1 rounded-full">
              {count} visit{count !== 1 ? 's' : ''}{filtering && of !== count && <span className="text-zinc-600">&nbsp;of {of}</span>}
            </span>
            <span className="inline-flex items-center text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-500/25 px-2.5 py-1 rounded-full font-mono">{formatMoney(total, sym)}</span>
          </div>
        ) : <span />}
        {filtering && <p className="text-zinc-600 text-[10px] leading-snug">Within {rangeLabel} — change dates above to widen</p>}
      </div>
    </div>
  );
}
