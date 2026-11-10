interface Option { value: string; label: string }
interface Props { options: ReadonlyArray<Option>; value: string; onChange: (value: string) => void; label: string }

/** A short list of choices as pills (replaces native <select> boxes). Wraps on small screens. */
export default function ChoicePills({ options, value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5 max-w-full">
      {options.map(o => (
        <button key={o.label} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${value === o.value ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
