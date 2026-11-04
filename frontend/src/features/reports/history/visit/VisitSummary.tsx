import Icon from 'components/ui/base/Icon';
import { tableDisplayLabel } from 'lib/input/ids';
import { formatDate, formatTime } from 'lib/format/local-time';
import { formatMoney, round2 } from 'lib/format/money';
import { countQuantity } from 'lib/orders/order-items';
import type { Visit } from 'lib/orders/visits';
import PaymentBadge from '../../components/PaymentBadge';
import { DiffBadge, OrderTypeBadge, Tag } from './VisitBadges';

interface Props { visit: Visit; sym: string; expanded: boolean; onToggle: () => void }

/** The always-visible line of a visit: table, badges, customer, time, amount. */
export default function VisitSummary({ visit: v, sym, expanded, onToggle }: Props) {
  const diff = round2(v.amountPaid - v.total);
  const hasDiff = Math.abs(diff) >= 0.01;
  const rounds = v.kitchenRounds.length;
  const items = countQuantity(v.items);
  return (
    <button type="button" aria-expanded={expanded} className="w-full px-3.5 sm:px-4 py-3 text-left flex items-start gap-3" onClick={onToggle}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white mt-0.5">{v.tableId}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="text-white text-sm font-semibold">{tableDisplayLabel(v.tableId)}</span>
          <OrderTypeBadge type={v.orderType} />
          {rounds > 1 && <Tag tone="brand">{`${rounds} rounds`}</Tag>}
          {v.orders.length > rounds && <Tag>+ direct bill</Tag>}
          <PaymentBadge method={v.paymentMethod} />
          {hasDiff && <DiffBadge diff={diff} sym={sym} />}
          {v.editedAt && <Tag tone="amber">Edited</Tag>}
        </div>
        {v.customerName && <div className="text-zinc-400 text-xs truncate mb-0.5">{v.customerName}{v.customerPhone && <span className="text-zinc-600"> · {v.customerPhone}</span>}</div>}
        <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
          <span>{formatDate(v.startedAt, { day: 'numeric', month: 'short' })}, {formatTime(v.startedAt)}</span><span className="text-zinc-700">·</span>
          <span>{items} item{items !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-start gap-2 pl-1">
        <div className="text-right leading-tight">
          {hasDiff ? (
            <><div className="font-mono text-zinc-500 text-[10px] line-through">{formatMoney(v.total, sym)}</div>
              <div className={`font-mono font-bold text-sm ${diff < 0 ? 'text-red-400' : 'text-blue-400'}`}>{formatMoney(v.amountPaid, sym)}</div></>
          ) : <div className="font-mono font-bold text-white text-sm pt-0.5">{formatMoney(v.total, sym)}</div>}
        </div>
        <Icon name="chevronDown" className={`w-4 h-4 text-zinc-500 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`} />
      </div>
    </button>
  );
}
