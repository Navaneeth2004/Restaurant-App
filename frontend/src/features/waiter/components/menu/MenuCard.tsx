import Icon from 'components/ui/base/Icon';
import { API_ORIGIN } from 'config/env';
import { formatMoney } from 'lib/format/money';
import type { MenuItem } from 'types/restaurant/catalog';

interface Props {
  item: MenuItem; qty: number; canOrder: boolean; stepper: boolean; sym: string;
  onAdd: (item: MenuItem) => void; onDecrease: (id: number) => void;
}

/** A <div role="button">: a real <button> cannot legally contain the stepper buttons. */
export default function MenuCard({ item, qty, canOrder, stepper, sym, onAdd, onDecrease }: Props) {
  const inCart = qty > 0;
  const round = 'w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform';
  return (
    <div role="button" tabIndex={canOrder ? 0 : -1} aria-disabled={!canOrder} onClick={() => { if (canOrder) onAdd(item); }}
      onKeyDown={e => { if (canOrder && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAdd(item); } }}
      className={`text-left rounded-xl border overflow-hidden bg-surface-card transition-all duration-150 relative select-none ${inCart ? 'border-brand-500/70 shadow-md shadow-brand-500/15' : 'border-surface-border'} ${canOrder ? 'hover:border-brand-500/50 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
      <div className="relative w-full bg-surface-raised overflow-hidden" style={{ paddingTop: '65%' }}>
        <div className="absolute inset-0">
          {item.image_path ? <img src={`${API_ORIGIN}${item.image_path}`} alt={item.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-[10px]">No image</div>}
          {!item.available && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-red-500/80 px-2 py-0.5 rounded-full">Sold Out</span>
            </div>
          )}
        </div>
        {stepper && canOrder ? (inCart ? (
          <div className="absolute top-1.5 right-1.5 flex items-center rounded-full bg-brand-500 border-2 border-surface-card shadow-lg" onClick={e => e.stopPropagation()}>
            <button type="button" aria-label={`Remove one ${item.name}`} className={round} onClick={() => onDecrease(item.id)}><Icon name="minus" strokeWidth={3} /></button>
            <span className="min-w-[22px] text-center font-mono font-bold text-white text-sm leading-none">{qty}</span>
            <button type="button" aria-label={`Add one ${item.name}`} className={round} onClick={() => onAdd(item)}><Icon name="plus" strokeWidth={3} /></button>
          </div>
        ) : (
          <button type="button" aria-label={`Add ${item.name}`} onClick={e => { e.stopPropagation(); onAdd(item); }}
            className={`${round} absolute top-1.5 right-1.5 rounded-full bg-brand-500 border-2 border-surface-card shadow-lg`}><Icon name="plus" strokeWidth={3} /></button>
        )) : inCart && (
          <div className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand-500 border-2 border-surface-card flex items-center justify-center shadow-lg">
            <span className="font-mono font-bold text-white text-[11px] leading-none">{qty}</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold leading-snug line-clamp-2 text-white">{item.name}</p>
        {item.description && <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-1">{item.description}</p>}
        <div className="flex items-center justify-between mt-1.5">
          <p className="font-mono font-semibold text-brand-400 text-sm">{formatMoney(item.price, sym)}</p>
          {inCart && <span className="text-[9px] font-bold uppercase tracking-wide text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded-full">In order</span>}
        </div>
      </div>
    </div>
  );
}
