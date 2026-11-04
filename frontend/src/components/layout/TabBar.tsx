interface Tab { key: string; label: string }
interface Props { tabs: ReadonlyArray<Tab>; active: string; onSelect: (key: string) => void; label: string }

/** Underlined tabs for a screen's sections. */
export default function TabBar({ tabs, active, onSelect, label }: Props) {
  return (
    <div className="flex-shrink-0 flex border-b border-surface-border bg-surface-card/50 overflow-x-auto no-scrollbar" role="tablist" aria-label={label}>
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => onSelect(t.key)}
          className={`flex-shrink-0 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${active === t.key ? 'border-brand-500 text-brand-400' : 'border-transparent text-zinc-500 hover:text-white'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
