import { SEVERITIES, Severity } from 'config/support';

export default function SeverityPicker({ value, onChange }: { value: Severity; onChange: (s: Severity) => void }) {
  const current = SEVERITIES.find(s => s.key === value);
  return (
    <div>
      <p className="label mb-2" id="sev-label">How bad is it?</p>
      <div role="radiogroup" aria-labelledby="sev-label" className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {SEVERITIES.map(s => {
          const on = value === s.key;
          return (
            <button key={s.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(s.key)} className="text-left p-2 sm:p-3 rounded-xl border transition-all"
              style={{ border: `1.5px solid ${on ? s.color : 'rgb(var(--surface-border))'}`, background: on ? `${s.color}1f` : 'transparent' }}>
              <span className="block text-[11px] sm:text-xs font-bold" style={{ color: on ? s.color : undefined }}>{s.label}</span>
              <span className="hidden sm:block text-zinc-500 text-[10px] leading-tight mt-0.5">{s.desc}</span>
            </button>
          );
        })}
      </div>
      <p className="sm:hidden text-zinc-500 text-[10px] mt-1.5">{current?.desc}</p>
    </div>
  );
}
