interface Tab { key: string; label: string }
interface Props { tabs: ReadonlyArray<Tab>; active: string; onSelect: (key: string) => void; label: string }

/** Compact pill switcher (Reports, Export, Backup headers). */
export default function PillTabs({ tabs, active, onSelect, label }: Props) {
  return (
    <div className="flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5 overflow-x-auto no-scrollbar max-w-full" role="tablist" aria-label={label}>
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => onSelect(t.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${active === t.key ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
