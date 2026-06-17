/**
 * components/waiter/CatTabs.tsx
 *
 * Horizontal scrollable category pill tabs.
 * Extracted from WaiterView.tsx.
 */

import React from 'react';
import type { Category } from '../../types';

interface Props {
  categories:   Category[];
  activeCatId:  number | null;
  setActiveCatId: (id: number) => void;
}

export default function CatTabs({ categories, activeCatId, setActiveCatId }: Props) {
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-2"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; }}
    >
      {categories.map(c => (
        <button
          key={c.id}
          onClick={() => setActiveCatId(c.id)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${activeCatId === c.id
              ? 'bg-brand-500 text-white border-brand-600 shadow-sm'
              : 'text-zinc-400 border-surface-border hover:text-white hover:border-zinc-600'}`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}