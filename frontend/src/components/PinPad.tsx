/**
 * components/PinPad.tsx
 *
 * Shared numeric PIN-entry grid, extracted from LoginScreen.tsx and
 * components/admin/PinModal.tsx — both previously duplicated the exact
 * same 12-cell grid layout, digit mapping, and back/submit button JSX
 * almost verbatim, differing only in size (LoginScreen used h-14 cells,
 * PinModal used h-12). Both now render this component instead.
 *
 * Only the numpad grid itself is shared — each caller still renders its
 * own PIN dots row above it, since PinModal's dots row has a shake
 * animation on wrong entry that LoginScreen's doesn't.
 */

import React from 'react';

interface PinPadProps {
  pin: string;
  loading?: boolean;
  /** 'lg' = LoginScreen sizing (h-14 cells), 'md' = PinModal sizing (h-12 cells). */
  size?: 'lg' | 'md';
  onDigit: (d: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const CELLS: ('digit' | 'back' | 'login')[] = [
  'digit','digit','digit',
  'digit','digit','digit',
  'digit','digit','digit',
  'back', 'digit','login',
];
const DIGIT_VALUES = [1,2,3,4,5,6,7,8,9,0];

export default function PinPad({ pin, loading = false, size = 'md', onDigit, onBack, onSubmit }: PinPadProps) {
  const isLg      = size === 'lg';
  const cellH     = isLg ? 'h-14' : 'h-12';
  const gap       = isLg ? 'gap-2.5' : 'gap-2';
  const spinnerSz = isLg ? 'w-5 h-5' : 'w-4 h-4';
  const digitExtra = isLg ? 'hover:border-zinc-500 active:bg-brand-500/20' : '';

  let digitIdx = 0;

  return (
    <div className={`grid grid-cols-3 ${gap}`}>
      {CELLS.map((type, i) => {
        if (type === 'digit') {
          const val = DIGIT_VALUES[digitIdx++];
          return (
            <button
              key={i}
              onClick={() => onDigit(String(val))}
              disabled={loading}
              className={`${cellH} rounded-xl font-mono font-medium text-lg border bg-surface-raised border-surface-border text-white hover:bg-zinc-600 ${digitExtra} active:scale-95 transition-all duration-100 select-none disabled:opacity-50`}
            >
              {val}
            </button>
          );
        }
        if (type === 'back') {
          return (
            <button
              key={i}
              onClick={onBack}
              disabled={loading || pin.length === 0}
              className={`${cellH} rounded-xl border bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all duration-100 select-none disabled:opacity-30 flex items-center justify-center`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
              </svg>
            </button>
          );
        }
        return (
          <button
            key={i}
            onClick={onSubmit}
            disabled={loading || pin.length < 4}
            className={`${cellH} rounded-xl border bg-brand-500 border-brand-600 text-white hover:bg-brand-600 active:scale-95 transition-all duration-100 select-none disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center`}
          >
            {loading
              ? <span className={`${spinnerSz} border-2 border-white/40 border-t-white rounded-full animate-spin`} />
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            }
          </button>
        );
      })}
    </div>
  );
}