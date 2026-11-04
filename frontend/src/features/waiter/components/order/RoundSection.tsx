import { ReactNode } from 'react';
import { formatMoney } from 'lib/format/money';

interface Props {
  label: string; dot: string; labelClass: string; total: number; sym: string;
  onCancelRound?: () => void; children: ReactNode; divider?: boolean;
}

export default function RoundSection({ label, dot, labelClass, total, sym, onCancelRound, children, divider = true }: Props) {
  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">{formatMoney(total, sym)}</span>
          {onCancelRound && (
            <button type="button" onClick={onCancelRound}
              className="text-[10px] font-semibold text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors">Cancel round</button>
          )}
        </div>
      </div>
      {children}
      {divider && <div className="border-t border-surface-border mt-2" />}
    </div>
  );
}
