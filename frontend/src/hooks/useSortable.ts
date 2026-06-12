/**
 * useSortable.ts
 *
 * A reusable hook that provides both mouse (HTML5 drag-and-drop) and
 * touch (long-press → drag) reordering for any list.
 *
 * Usage:
 *   const { getItemProps, ghostStyle, ghostItem } = useSortable({
 *     items,
 *     getId: item => item.id,
 *     onReorder: newItems => { ... },
 *   });
 *
 *   // In JSX:
 *   {items.map(item => (
 *     <div key={item.id} {...getItemProps(item.id)}>
 *       {item.name}
 *     </div>
 *   ))}
 *   {ghostItem && (
 *     <div style={ghostStyle}>{ghostItem.name}</div>
 *   )}
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
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  'data-sortable-id': string;
  style: React.CSSProperties;
}

interface UseSortableReturn<T> {
  /** Spread these props onto each sortable item element */
  getItemProps: (id: string | number) => SortableItemProps;
  /** The id of the item currently being dragged (for styling) */
  draggingId: string | number | null;
  /** The id of the item currently being hovered over */
  dragOverId: string | number | null;
}

export function useSortable<T>({
  items,
  getId,
  onReorder,
  longPressDuration = 300,
}: UseSortableOptions<T>): UseSortableReturn<T> {
  const [draggingId, setDraggingId]   = useState<string | number | null>(null);
  const [dragOverId, setDragOverId]   = useState<string | number | null>(null);

  // Touch state
  const touchDragging  = useRef(false);
  const touchStartId   = useRef<string | number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos  = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMoved       = useRef(false);

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

  // ── Mouse / HTML5 drag ──────────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, id: string | number) => {
    e.dataTransfer.effectAllowed = 'move';
    // Store dragged id in dataTransfer so onDrop knows what was dragged
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
    // Parse back to number if items use numeric ids
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
        // Haptic feedback on supported devices
        if (navigator.vibrate) navigator.vibrate(40);
      }
    }, longPressDuration);
  }, [longPressDuration]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // If they moved before long-press fired, cancel the timer
    if (dx > 8 || dy > 8) {
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (!touchDragging.current) return;

    // Prevent page scroll while dragging a sortable item
    e.preventDefault();

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
  }, []);

  const onTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (touchDragging.current && touchStartId.current !== null && dragOverId !== null) {
      reorder(touchStartId.current, dragOverId);
    }
    touchDragging.current = false;
    touchStartId.current  = null;
    setDraggingId(null);
    setDragOverId(null);
  }, [dragOverId, reorder]);

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
      onTouchStart: (e: React.TouchEvent) => onTouchStart(e, id),
      onTouchMove:  (e: React.TouchEvent) => onTouchMove(e),
      onTouchEnd:   (_e: React.TouchEvent) => onTouchEnd(),
      style: {
        opacity:   isDragging ? 0.3 : 1,
        transform: isDragging ? 'scale(0.95)' : isOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        // Highlight drop target
        outline: isOver ? '2px solid var(--brand, #f97316)' : 'none',
        outlineOffset: '2px',
        borderRadius: 'inherit',
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        touchAction: touchDragging.current ? 'none' : 'auto',
      },
    };
  }, [draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, onTouchStart, onTouchMove, onTouchEnd]);

  return { getItemProps, draggingId, dragOverId };
}