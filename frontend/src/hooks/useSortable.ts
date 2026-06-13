/**
 * useSortable.ts
 *
 * A reusable hook that provides both mouse (HTML5 drag-and-drop) and
 * touch (long-press → drag) reordering for any list.
 *
 * Fix: touchmove listener is attached manually with { passive: false }
 * so that e.preventDefault() works and the page doesn't scroll during drag.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSortableOptions<T> {
  items: T[];
  getId: (item: T) => string | number;
  onReorder: (newItems: T[]) => void;
  /** Minimum ms of press before touch drag begins (default 300) */
  longPressDuration?: number;
}

interface SortableItemProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  'data-sortable-id': string;
  style: React.CSSProperties;
}

interface UseSortableReturn<T> {
  getItemProps: (id: string | number) => SortableItemProps;
  draggingId: string | number | null;
  dragOverId: string | number | null;
}

export function useSortable<T>({
  items,
  getId,
  onReorder,
  longPressDuration = 300,
}: UseSortableOptions<T>): UseSortableReturn<T> {
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | number | null>(null);

  // Touch state
  const touchDragging  = useRef(false);
  const touchStartId   = useRef<string | number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos  = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMoved       = useRef(false);
  const dragOverIdRef  = useRef<string | number | null>(null);

  // Keep ref in sync with state so the native touchmove handler can read it
  useEffect(() => { dragOverIdRef.current = dragOverId; }, [dragOverId]);

  // Clean up timers on unmount
  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const reorder = useCallback((fromId: string | number, toId: string | number) => {
    if (fromId === toId) return;
    const from = items.findIndex(i => getId(i) === fromId);
    const to   = items.findIndex(i => getId(i) === toId);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }, [items, getId, onReorder]);

  // ── Attach a single non-passive touchmove listener on the document ──
  // This is the only way to call preventDefault() and stop page scroll.
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchDragging.current) return;

      // Block page scroll while dragging
      e.preventDefault();

      const touch = e.touches[0];

      // Hit-test which element is under the finger
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const target = el?.closest('[data-sortable-id]') as HTMLElement | null;
      if (target) {
        const overId = target.getAttribute('data-sortable-id');
        if (overId !== null) {
          const parsed = isNaN(Number(overId)) ? overId : Number(overId);
          setDragOverId(parsed);
        }
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => document.removeEventListener('touchmove', handleTouchMove);
  }, []); // mount/unmount only — touchDragging is a ref so no dep needed

  // ── Mouse / HTML5 drag ──────────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, id: string | number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    setDraggingId(id);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, id: string | number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, toId: string | number) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    const parsedFromId = isNaN(Number(fromId)) ? fromId : Number(fromId);
    reorder(parsedFromId, toId);
    setDraggingId(null);
    setDragOverId(null);
  }, [reorder]);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  // ── Touch drag ──────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent, id: string | number) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchStartId.current  = id;
    hasMoved.current      = false;
    touchDragging.current = false;

    longPressTimer.current = setTimeout(() => {
      if (!hasMoved.current) {
        touchDragging.current = true;
        setDraggingId(id);
        if (navigator.vibrate) navigator.vibrate(40);
      }
    }, longPressDuration);
  }, [longPressDuration]);

  const onTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (touchDragging.current && touchStartId.current !== null && dragOverIdRef.current !== null) {
      reorder(touchStartId.current, dragOverIdRef.current);
    }
    touchDragging.current = false;
    touchStartId.current  = null;
    setDraggingId(null);
    setDragOverId(null);
  }, [reorder]);

  // Cancel long-press if finger moves before threshold
  // NOTE: we no longer pass onTouchMove as a React prop — it's handled by the
  // document-level listener above. We only need to cancel the long-press timer here.
  const onTouchStartWithCancelRef = useCallback((e: React.TouchEvent, id: string | number) => {
    onTouchStart(e, id);

    // Inline cancel-on-move via a one-shot pointermove trick
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;

    const cancelMove = (me: TouchEvent) => {
      const dx = Math.abs(me.touches[0].clientX - startX);
      const dy = Math.abs(me.touches[0].clientY - startY);
      if (dx > 8 || dy > 8) {
        hasMoved.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        document.removeEventListener('touchmove', cancelMove);
      }
    };
    document.addEventListener('touchmove', cancelMove, { passive: true });
    // Clean up the cancel listener on touchend regardless
    document.addEventListener('touchend', () => document.removeEventListener('touchmove', cancelMove), { once: true });
  }, [onTouchStart]);

  // ── Compose item props ──────────────────────────────────────────────
  const getItemProps = useCallback((id: string | number): SortableItemProps => {
    const isDragging = draggingId === id;
    const isOver     = dragOverId === id && draggingId !== id;

    return {
      draggable: true,
      'data-sortable-id': String(id),
      onDragStart: (e: React.DragEvent) => onDragStart(e, id),
      onDragOver:  (e: React.DragEvent) => onDragOver(e, id),
      onDrop:      (e: React.DragEvent) => onDrop(e, id),
      onDragEnd:   (_e: React.DragEvent) => onDragEnd(),
      onTouchStart: (e: React.TouchEvent) => onTouchStartWithCancelRef(e, id),
      onTouchEnd:   (_e: React.TouchEvent) => onTouchEnd(),
      style: {
        opacity:   isDragging ? 0.3 : 1,
        transform: isDragging ? 'scale(0.95)' : isOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        outline: isOver ? '2px solid var(--brand, #f97316)' : 'none',
        outlineOffset: '2px',
        borderRadius: 'inherit',
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        touchAction: 'none',
      },
    };
  }, [draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, onTouchStartWithCancelRef, onTouchEnd]);

  return { getItemProps, draggingId, dragOverId };
}