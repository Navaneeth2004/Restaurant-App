import Icon from 'components/ui/base/Icon';
import { useCopyText } from 'hooks/browser/useCopyText';
import { formatMoney } from 'lib/format/money';
import { AmountRow, copyText } from '../../hooks/gst-rows';

interface Props { title: string; subtitle?: string; rows: ReadonlyArray<AmountRow>; sym: string }

/** A card of figures to type into the GST portal. Every row is a button: click copies the bare number. */
export default function AmountTable({ title, subtitle, rows, sym }: Props) {
  const copy = useCopyText();
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="bg-surface-raised px-4 py-3 border-b border-surface-border">
        <p className="text-zinc-300 text-xs font-semibold">{title}</p>
        {subtitle && <p className="text-zinc-600 text-[10px] mt-0.5">{subtitle}</p>}
      </div>
      {rows.length === 0 ? <p className="px-4 py-4 text-zinc-600 text-xs">No figures for this period.</p> : (
        <ul className="divide-y divide-surface-border">
          {rows.map(r => (
            <li key={r.label}>
              <button type="button" aria-label={`Copy ${r.label}`} onClick={() => void copy(r.label, copyText(r))}
                className={`group w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-raised transition-colors ${r.emphasis ? 'bg-surface-raised/50' : ''}`}>
                <span className={`text-sm ${r.emphasis ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}`}>{r.label}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className={`font-mono text-sm ${r.emphasis ? 'text-white font-bold' : 'text-zinc-200'}`}>{r.kind === 'count' ? r.value : formatMoney(r.value, sym)}</span>
                  <Icon name="copy" className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
