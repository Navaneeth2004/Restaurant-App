import Icon from 'components/ui/base/Icon';
import { elapsedLabel, minutesSince } from 'lib/format/local-time';
import { formatMoney, sumLines } from 'lib/format/money';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';
import { tableHeat } from '../../hooks/floor-metrics';
import { HEAT } from '../../floor-style';

interface Props { table: Table; order: Order | null; sym: string; nowMs: number; selected: boolean; onClick: () => void }

export default function FloorTableCard({ table, order, sym, nowMs, selected, onClick }: Props) {
  const mins = minutesSince(table.occupied_since, nowMs);
  const heat = tableHeat(table.status, mins);
  const c = HEAT[heat];
  const empty = heat === 'empty';
  const kitchenValue = order ? sumLines(order.items) : 0;
  const items = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} style={{
      border: `1.5px solid ${selected ? 'var(--brand,#f97316)' : c.border}`, background: c.bg, boxShadow: selected ? `0 0 0 3px rgba(249,115,22,0.22), ${c.glow}` : c.glow,
      borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', width: '100%', minHeight: 150, transition: 'all .18s ease',
    }}>
      <div className="flex justify-between items-start">
        <span className="fl-value text-xl tracking-tight" style={{ color: empty ? 'var(--fl-muted)' : 'var(--fl-text)' }}>{table.id}</span>
        <span className="w-[9px] h-[9px] rounded-full mt-[3px] flex-shrink-0" style={{ background: c.dot, boxShadow: empty ? 'none' : `0 0 7px ${c.dot}` }} />
      </div>
      <div>
        <p className="text-xs font-semibold m-0" style={{ color: empty ? 'var(--fl-muted)' : 'var(--fl-text3)' }}>{table.label}</p>
        <p className="fl-sub text-[10px] mt-0.5">{table.seats} seats{items > 0 ? ` · ${items} in kitchen` : ''}</p>
      </div>
      <div className="mt-auto flex flex-col gap-1.5">
        {!empty && table.occupied_since ? (
          <>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-[7px] py-[3px] rounded-full text-[10px] font-bold font-mono" style={{ background: c.pill, color: c.pillText, border: `1px solid ${c.pillBorder}` }}>
                <Icon name="clock" className="w-2.5 h-2.5" strokeWidth={2.5} />{elapsedLabel(mins)}
              </span>
              {kitchenValue > 0 && <span className="fl-value text-[13px]" style={{ color: 'var(--fl-text)' }} title="Value of the round in the kitchen">{formatMoney(kitchenValue, sym)}</span>}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.tagColor }}>{c.tag}</span>
          </>
        ) : <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.tagColor }}>{c.tag}</span>}
      </div>
    </button>
  );
}
