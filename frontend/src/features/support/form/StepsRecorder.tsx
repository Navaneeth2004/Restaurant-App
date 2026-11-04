import { useRef, useState } from 'react';
import Icon from 'components/ui/base/Icon';
import { TICKET_LIMITS } from 'config/support';

interface Props { steps: string[]; onChange: (steps: string[]) => void }

/** Numbered "steps to reproduce". Enter adds a step; the server keeps at most 30. */
export default function StepsRecorder({ steps, onChange }: Props) {
  const [current, setCurrent] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const full = steps.length >= TICKET_LIMITS.steps;

  const add = (): void => {
    const t = current.trim();
    if (!t || full) return;
    onChange([...steps, t]);
    setCurrent('');
    input.current?.focus();
  };
  return (
    <div>
      <ol className="space-y-2 mb-2">
        {steps.map((step, i) => (
          <li key={`${i}-${step}`} className="flex items-start gap-2.5 group">
            <span className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
            <span className="flex-1 text-zinc-200 text-sm leading-relaxed pt-0.5">{step}</span>
            <button type="button" aria-label={`Remove step ${i + 1}`} onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
              className="w-5 h-5 rounded flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0 mt-0.5"><Icon name="x" className="w-3 h-3" /></button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <input ref={input} aria-label="Next step" className="input flex-1 text-sm" disabled={full} value={current} onChange={e => setCurrent(e.target.value)}
          placeholder={steps.length === 0 ? 'e.g. "Tapped Table 3 then added items"' : 'Add next step…'} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!current.trim() || full} className="btn btn-sm flex-shrink-0">Add</button>
      </div>
      <p className="text-zinc-600 text-[10px] mt-1.5">{full ? `That is the most steps a ticket can hold (${TICKET_LIMITS.steps}).` : 'Press Enter to add each step. These help the developer reproduce the issue.'}</p>
    </div>
  );
}
