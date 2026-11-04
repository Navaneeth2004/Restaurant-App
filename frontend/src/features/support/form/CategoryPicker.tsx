import { CATEGORIES } from 'config/support';

export default function CategoryPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <p className="label mb-2" id="cat-label">Which part of the app?</p>
      <div role="radiogroup" aria-labelledby="cat-label" className="grid grid-cols-3 gap-1.5">
        {CATEGORIES.map(c => (
          <button key={c.key} type="button" role="radio" aria-checked={value === c.key} onClick={() => onChange(c.key)}
            className={`px-2.5 py-2 rounded-lg border text-left transition-all text-[11px] font-semibold ${value === c.key ? 'bg-brand-500/15 border-brand-500/50 text-brand-400' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}>
            <span className="block truncate">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
