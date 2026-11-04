import { isParcelTable } from 'lib/input/ids';
import type { MobileTab, WaiterState } from '../hooks/useWaiter';
import CategoryTabs from './menu/CategoryTabs';
import MenuGrid from './menu/MenuGrid';
import OrderPanel from './order/OrderPanel';
import TableList from './tables/TableList';

export default function WaiterMobile({ w }: { w: WaiterState }) {
  const tabs: { key: MobileTab; label: string }[] = [
    { key: 'tables', label: 'Tables' },
    { key: 'menu', label: w.table ? `Menu — ${w.table.id}` : 'Menu' },
    { key: 'order', label: 'Order' },
  ];
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-shrink-0 flex border-b border-surface-border bg-surface-card" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={w.tab === t.key} onClick={() => w.setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 relative ${w.tab === t.key ? 'text-brand-400 border-brand-500' : 'text-zinc-500 border-transparent'}`}>
            {t.label}
            {t.key === 'order' && w.carts.cart.length > 0 && <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">{w.carts.cart.length}</span>}
          </button>
        ))}
      </div>
      {w.tab === 'tables' && (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-zinc-500 text-xs mb-3">Tap to select, then go to Menu</p>
          <TableList w={w} mobile />
        </div>
      )}
      {w.tab === 'menu' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-3 pt-2.5 border-b border-surface-border bg-surface-card/50">
            {w.table ? (
              <div className="flex items-center gap-2 mb-2">
                <p className="font-semibold text-white text-sm">{w.table.label}</p>
                {isParcelTable(w.table) && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">Parcel</span>}
              </div>
            ) : <p className="text-zinc-500 text-xs pb-2.5 text-center">Select a table or parcel slot first</p>}
            <CategoryTabs categories={w.menu.categories} activeId={w.categoryId} onSelect={w.setCategoryId} />
          </div>
          <div className="flex-1 overflow-y-auto p-3"><MenuGrid w={w} stepper cols="grid-cols-2" /></div>
        </div>
      )}
      {w.tab === 'order' && <div className="flex-1 flex flex-col overflow-hidden bg-surface-card"><OrderPanel w={w} /></div>}
    </div>
  );
}
