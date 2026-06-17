/**
 * components/bug/StepsRecorder.tsx
 *
 * Interactive step-by-step reproducer list for bug reports.
 * Extracted from BugReportView.tsx.
 */

import React, { useState, useRef } from 'react';

interface Props {
  steps:    string[];
  onChange: (steps: string[]) => void;
}

export default function StepsRecorder({ steps, onChange }: Props) {
  const [current, setCurrent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const t = current.trim();
    if (!t) return;
    onChange([...steps, t]);
    setCurrent('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  };

  return (
    <div>
      <div className="space-y-2 mb-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5 group">
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <span className="flex-1 text-zinc-200 text-sm leading-relaxed pt-0.5">{step}</span>
            <button
              onClick={() => remove(i)}
              className="w-5 h-5 rounded flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="input flex-1 text-sm"
          placeholder={steps.length === 0 ? 'e.g. "Tapped Table 3 then added items"' : 'Add next step…'}
          value={current}
          onChange={e => setCurrent(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          onClick={add}
          disabled={!current.trim()}
          className="btn btn-sm flex-shrink-0 disabled:opacity-30"
        >
          Add
        </button>
      </div>
      <p className="text-zinc-600 text-[10px] mt-1.5">
        Press Enter to add each step. These help the developer reproduce the issue.
      </p>
    </div>
  );
}