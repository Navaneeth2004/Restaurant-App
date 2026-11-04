import { CSSProperties, DragEvent, TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reorderList, SortId } from './reorder';
import { useTouchDrag } from './useTouchDrag';

interface Options<T> { items: ReadonlyArray<T>; getId: (item: T) => SortId; onReorder: (next: T[]) => void; longPressMs?: number }

export interface SortableItemProps {
  draggable: boolean;
  'data-sortable-id': string;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
  onTouchStart: (e: TouchEvent) => void;
  style: CSSProperties;
}

const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/**
 * Drag-and-drop reordering for mouse (HTML5 drag) and touch (long-press). Ids are matched by identity,
 * never re-parsed from strings, so "1" and 1 can no longer be confused.
 * draggable is OFF on touch devices: native drag fights the touch handlers and can freeze the page.
 */
export function useSortable<T>({ items, getId, onReorder, longPressMs = 300 }: Options<T>) {
  const [draggingId, setDraggingId] = useState<SortId | null>(null);
  const [overId, setOverId] = useState<SortId | null>(null);
  const from = useRef<SortId | null>(null);
  const latest = useRef({ items, getId, onReorder });
  useEffect(() => { latest.current = { items, getId, onReorder }; });
  const byKey = useMemo(() => new Map(items.map(i => [String(getId(i)), getId(i)] as const)), [items, getId]);

  const drop = useCallback((a: SortId, b: SortId) => {
    const next = reorderList(latest.current.items, a, b, latest.current.getId);
    if (next) latest.current.onReorder(next);
  }, []);
  const reset = useCallback(() => { from.current = null; setDraggingId(null); setOverId(null); }, []);

  const touchStart = useTouchDrag({
    longPressMs,
    resolve: el => { const key = el?.closest('[data-sortable-id]')?.getAttribute('data-sortable-id'); return key == null ? null : byKey.get(key) ?? null; },
    onStart: id => { setDraggingId(id); setOverId(id); },
    onOver: setOverId,
    onDrop: drop,
    onEnd: reset,
  });

  const getItemProps = useCallback((id: SortId): SortableItemProps => {
    const dragging = draggingId === id;
    const over = overId === id && draggingId !== id;
    return {
      draggable: !isTouchDevice,
      'data-sortable-id': String(id),
      onDragStart: e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)); from.current = id; setDraggingId(id); },
      onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverId(id); },
      onDrop: e => { e.preventDefault(); if (from.current !== null) drop(from.current, id); reset(); },
      onDragEnd: reset,
      onTouchStart: e => touchStart(e, id),
      style: {
        opacity: dragging ? 0.35 : 1,
        transform: dragging ? 'scale(0.97)' : over ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        cursor: dragging ? 'grabbing' : 'grab',
        outline: over ? '2px solid var(--brand, #f97316)' : 'none',
        outlineOffset: 2,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: dragging ? 'none' : 'auto',
      },
    };
  }, [draggingId, overId, drop, reset, touchStart]);

  return { getItemProps, draggingId, overId };
}
