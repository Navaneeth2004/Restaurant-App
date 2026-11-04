import type { Category } from 'types/restaurant/catalog';

interface Props { categories: ReadonlyArray<Category>; activeId: number | null; onSelect: (id: number) => void }

export default function CategoryTabs({ categories, activeId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar" onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; }}>
      {categories.map(c => (
        <button key={c.id} type="button" onClick={() => onSelect(c.id)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeId === c.id ? 'bg-brand-500 text-white border-brand-600 shadow-sm' : 'text-zinc-400 border-surface-border hover:text-white hover:border-zinc-600'}`}>
          {c.name}
        </button>
      ))}
    </div>
  );
}
