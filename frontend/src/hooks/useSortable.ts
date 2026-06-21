/**
 * useSortable.ts
 *
 * Reusable hook for drag-and-drop reordering (mouse + touch).
 *
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
    touchId: number | null; // identifier of the touch driving this gesture
  }>({
    dragging: false,
    startId: null,
    overId: null,
    startX: 0,
    startY: 0,
    moved: false,
    timer: null,
    touchId: null,
  });

  // rAF throttle handle for elementFromPoint hit-testing during touchmove
  const rafRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);

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
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
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
    // Resolve the touch matching our tracked identifier from a TouchList
    const findTrackedTouch = (touches: TouchList): Touch | null => {
      const s = touchState.current;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === s.touchId) return touches[i];
      }
      return null;
    };

    const runHitTest = (x: number, y: number) => {
      const s = touchState.current;
      if (!s.dragging) return;
      const el = document.elementFromPoint(x, y);
      const target = el?.closest('[data-sortable-id]') as HTMLElement | null;
      if (target) {
        const raw = target.getAttribute('data-sortable-id');
        if (raw !== null) {
          const parsed = isNaN(Number(raw)) ? raw : Number(raw);
          if (s.overId !== parsed) {
            s.overId = parsed;
            setDragOverId(parsed);
          }
        }
      }
    };

    const handleMove = (e: TouchEvent) => {
      const s = touchState.current;
      if (!s.dragging) return;

      const touch = findTrackedTouch(e.touches);
      if (!touch) return; // a different finger moved — ignore

      e.preventDefault(); // block page scroll while actively dragging

      // Throttle the expensive elementFromPoint hit-test to once per frame
      pendingPointRef.current = { x: touch.clientX, y: touch.clientY };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const p = pendingPointRef.current;
          if (p) runHitTest(p.x, p.y);
        });
      }
    };

    const handleEnd = (e: TouchEvent) => {
      const s = touchState.current;

      // Only finalize when the tracked touch is the one that ended/cancelled.
      // changedTouches tells us which touch(es) just lifted.
      let trackedEnded = s.touchId === null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === s.touchId) { trackedEnded = true; break; }
      }
      if (!trackedEnded) return;

      if (s.dragging && s.startId !== null && s.overId !== null) {
        doReorder(s.startId, s.overId);
      }
      // Reset all state
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      pendingPointRef.current = null;
      s.dragging = false;
      s.startId  = null;
      s.overId   = null;
      s.moved    = false;
      s.touchId  = null;
      setDraggingId(null);
      setDragOverId(null);

      cleanup();
    };

    document.addEventListener('touchmove',   handleMove,   { passive: false });
    document.addEventListener('touchend',    handleEnd,    { passive: true });
    document.addEventListener('touchcancel', handleEnd,    { passive: true });

    const cleanup = () => {
      document.removeEventListener('touchmove',   handleMove);
      document.removeEventListener('touchend',    handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
      cleanupDocListeners.current = null;
    };
    cleanupDocListeners.current = cleanup;
  }, [doReorder]);

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
    // Ignore if a gesture is already tracked (e.g. a second finger touched
    // down on another card while the first is still being processed).
    if (touchState.current.touchId !== null) return;

    const touch = e.touches[0];
    const s = touchState.current;

    // Cancel any in-progress drag (defensive — shouldn't normally happen
    // given the guard above, but keeps state consistent if it does)
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    if (cleanupDocListeners.current) { cleanupDocListeners.current(); }

    s.startId  = id;
    s.startX   = touch.clientX;
    s.startY   = touch.clientY;
    s.moved    = false;
    s.dragging = false;
    s.overId   = null;
    s.touchId  = touch.identifier;

    // Watch for early finger movement to cancel long-press (this lets a
    // normal scroll gesture proceed instead of triggering a drag).
    const cancelOnMove = (me: TouchEvent) => {
      let t: Touch | null = null;
      for (let i = 0; i < me.touches.length; i++) {
        if (me.touches[i].identifier === s.touchId) { t = me.touches[i]; break; }
      }
      if (!t) return;
      const dx = Math.abs(t.clientX - s.startX);
      const dy = Math.abs(t.clientY - s.startY);
      if (dx > 8 || dy > 8) {
        s.moved = true;
        if (s.timer) { clearTimeout(s.timer); s.timer = null; }
        document.removeEventListener('touchmove', cancelOnMove);
        // Gesture turned out to be a scroll, not a long-press — release
        // the tracked touch id so a fresh press can be tracked later.
        if (!s.dragging) s.touchId = null;
      }
    };
    document.addEventListener('touchmove', cancelOnMove, { passive: true });

    // Also release tracking if the finger lifts before the long-press fires
    // (e.g. a quick tap) — otherwise touchId stays "stuck" and blocks new
    // gestures via the guard at the top of this function.
    const releaseOnEnd = (me: TouchEvent) => {
      for (let i = 0; i < me.changedTouches.length; i++) {
        if (me.changedTouches[i].identifier === s.touchId) {
          document.removeEventListener('touchmove', cancelOnMove);
          document.removeEventListener('touchend', releaseOnEnd);
          document.removeEventListener('touchcancel', releaseOnEnd);
          if (!s.dragging) {
            if (s.timer) { clearTimeout(s.timer); s.timer = null; }
            s.touchId = null;
          }
          return;
        }
      }
    };
    document.addEventListener('touchend', releaseOnEnd, { passive: true });
    document.addEventListener('touchcancel', releaseOnEnd, { passive: true });

    s.timer = setTimeout(() => {
      document.removeEventListener('touchmove', cancelOnMove);
      document.removeEventListener('touchend', releaseOnEnd);
      document.removeEventListener('touchcancel', releaseOnEnd);
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
        // FIX: only block native touch gestures on the item actually being
        // dragged. Previously this was 'none' for every item at all times,
        // which prevented scrolling the whole grid on touch devices since
        // every card under the finger refused to hand off the gesture.
        touchAction: isDragging ? 'none' : 'auto',
      },
    };
  }, [draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, onTouchStart]);

  return { getItemProps, draggingId, dragOverId };
}