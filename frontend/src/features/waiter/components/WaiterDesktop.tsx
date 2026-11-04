import type { WaiterState } from '../hooks/useWaiter';
import MenuColumn from './menu/MenuColumn';
import OrderPanel from './order/OrderPanel';
import TableList from './tables/TableList';

export default function WaiterDesktop({ w }: { w: WaiterState }) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="w-48 lg:w-56 xl:w-72 flex-shrink-0 flex flex-col border-r border-surface-border bg-surface-card">
        <div className="px-3 py-2.5 border-b border-surface-border"><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tables</p></div>
        <div className="flex-1 overflow-y-auto p-3"><TableList w={w} mobile={false} /></div>
      </aside>
      <MenuColumn w={w} />
      <aside className="w-64 xl:w-72 flex-shrink-0 border-l border-surface-border bg-surface-card flex flex-col"><OrderPanel w={w} /></aside>
    </div>
  );
}
