/**
 * useSortable.ts
 *
 * Reusable hook for drag-and-drop reordering (mouse + touch).
 *
 * KEY FIXES vs previous version:
 * 1. Touch state is stored in refs, not closures – so the document-level
 *    touchmove/touchend handlers always see the current values even after
 *    re-renders (the old version captured stale closure state).
 * 2. Only ONE pair of document listeners is attached per hook instance,
 *    added on touchstart and cleaned up on touchend/cancel.  The previous
 *    version attached a permanent document listener on mount and a second
 *    per-item "cancel" listener, which left orphaned listeners after the
 *    first drag completed and caused subsequent drags to silently fail.
 * 3. touchend is now handled by the same document listener (not a React
 *    synthetic event) so it fires reliably even when the finger lifts
 *    outside the original element.
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

  // ── All touch state in refs so document listeners see live values ──────
  const touchState = useRef<{
    dragging: boolean;
    startId: string | number | null;
    overId: string | number | null;
    startX: number;
    startY: number;
    moved: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  }>({
    dragging: false,
    startId: null,
    overId: null,
    startX: 0,
    startY: 0,
    moved: false,
    timer: null,
  });

  // Keep items ref current so reorder callback always sees the latest list
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // Clean up on unmount
  useEffect(() => () => {
    const s = touchState.current;
    if (s.timer) clearTimeout(s.timer);
  }, []);

  const doReorder = useCallback(
    (fromId: string | number, toId: string | number) => {
      if (fromId === toId) return;
      const list = itemsRef.current;
      const getId = getIdRef.current;
      const from = list.findIndex(i => getId(i) === fromId);
      const to   = list.findIndex(i => getId(i) === toId);
      if (from === -1 || to === -1) return;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorderRef.current(next);
    },
    []
  );

  // ── Document-level touch handlers (attached per-drag, not permanently) ─
  const cleanupDocListeners = useRef<(() => void) | null>(null);

  const attachDocListeners = useCallback(() => {
    const handleMove = (e: TouchEvent) => {
      const s = touchState.current;
      if (!s.dragging) return;

      e.preventDefault(); // block page scroll

      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const target = el?.closest('[data-sortable-id]') as HTMLElement | null;
      if (target) {
        const raw = target.getAttribute('data-sortable-id');
        if (raw !== null) {
          const parsed = isNaN(Number(raw)) ? raw : Number(raw);
          s.overId = parsed;
          setDragOverId(parsed);
        }
      }
    };

    const handleEnd = (_e: TouchEvent) => {
      const s = touchState.current;
      if (s.dragging && s.startId !== null && s.overId !== null) {
        doReorder(s.startId, s.overId);
      }
      // Reset all state
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      s.dragging = false;
      s.startId  = null;
      s.overId   = null;
      s.moved    = false;
      setDraggingId(null);
      setDragOverId(null);

      // Remove listeners
      cleanup();
    };

    const handleCancel = () => handleEnd(new TouchEvent('touchcancel'));

    document.addEventListener('touchmove',   handleMove,   { passive: false });
    document.addEventListener('touchend',    handleEnd,    { passive: true });
    document.addEventListener('touchcancel', handleCancel, { passive: true });

    const cleanup = () => {
      document.removeEventListener('touchmove',   handleMove);
      document.removeEventListener('touchend',    handleEnd);
      document.removeEventListener('touchcancel', handleCancel);
      cleanupDocListeners.current = null;
    };
    cleanupDocListeners.current = cleanup;
  }, [doReorder, longPressDuration]);

  // ── Mouse / HTML5 drag ──────────────────────────────────────────────────
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
    const raw = e.dataTransfer.getData('text/plain');
    const fromId = isNaN(Number(raw)) ? raw : Number(raw);
    doReorder(fromId, toId);
    setDraggingId(null);
    setDragOverId(null);
  }, [doReorder]);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  // ── Touch start ─────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent, id: string | number) => {
    const touch = e.touches[0];
    const s = touchState.current;

    // Cancel any in-progress drag
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    if (cleanupDocListeners.current) { cleanupDocListeners.current(); }

    s.startId  = id;
    s.startX   = touch.clientX;
    s.startY   = touch.clientY;
    s.moved    = false;
    s.dragging = false;
    s.overId   = null;

    // Watch for early finger movement to cancel long-press
    const cancelOnMove = (me: TouchEvent) => {
      const dx = Math.abs(me.touches[0].clientX - s.startX);
      const dy = Math.abs(me.touches[0].clientY - s.startY);
      if (dx > 8 || dy > 8) {
        s.moved = true;
        if (s.timer) { clearTimeout(s.timer); s.timer = null; }
        document.removeEventListener('touchmove', cancelOnMove);
      }
    };
    document.addEventListener('touchmove', cancelOnMove, { passive: true });

    s.timer = setTimeout(() => {
      document.removeEventListener('touchmove', cancelOnMove);
      if (!s.moved) {
        s.dragging = true;
        s.overId   = id; // start over self
        setDraggingId(id);
        setDragOverId(id);
        if (navigator.vibrate) navigator.vibrate(40);
        attachDocListeners();
      }
    }, longPressDuration);
  }, [longPressDuration, attachDocListeners]);

  // ── Compose item props ──────────────────────────────────────────────────
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
      style: {
        opacity:    isDragging ? 0.35 : 1,
        transform:  isDragging ? 'scale(0.97)' : isOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        cursor:     isDragging ? 'grabbing' : 'grab',
        outline:    isOver ? '2px solid var(--brand, #f97316)' : 'none',
        outlineOffset: '2px',
        borderRadius: 'inherit',
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        touchAction: 'none',
      },
    };
  }, [draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, onTouchStart]);

  return { getItemProps, draggingId, dragOverId };
}