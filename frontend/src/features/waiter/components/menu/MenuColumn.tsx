import { isParcelTable } from 'lib/input/ids';
import type { WaiterState } from '../../hooks/useWaiter';
import CategoryTabs from './CategoryTabs';
import MenuGrid from './MenuGrid';

export default function MenuColumn({ w }: { w: WaiterState }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-3 pb-0 border-b border-surface-border bg-surface-card/50">
        <div className="mb-2 flex items-center gap-2">
          {w.table ? (
            <>
              <span className="font-semibold text-white text-sm">{w.table.label}</span>
              {isParcelTable(w.table) && <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">Parcel</span>}
            </>
          ) : <span className="text-zinc-500 text-sm">Select a table or parcel slot</span>}
        </div>
        <CategoryTabs categories={w.menu.categories} activeId={w.categoryId} onSelect={w.setCategoryId} />
      </div>
      <div className="flex-1 overflow-y-auto p-4"><MenuGrid w={w} stepper={false} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" /></div>
    </div>
  );
}
