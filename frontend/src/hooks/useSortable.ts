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

// Detect touch capability once at module load — avoids recalculating per render.
// On hybrid devices (Surface, iPad with mouse), we prefer touch-safe mode
// because the page likely receives touch events.
const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

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
    touchId: number | null;
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
      if (!touch) return;

      e.preventDefault(); // block page scroll while actively dragging

      pendingPointRef.current = { x: touch.clientX, y: touch.clientY };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const p = pendingPointRef.current;
          if (p) runHitTest(p.x, p.y);
        });
      }
    };

    // Define cleanup before handleEnd so the closure captures it correctly
    // (avoids temporal dead zone fragility from the original ordering).
    let cleanupCalled = false;
    const cleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;
      document.removeEventListener('touchmove',   handleMove);
      document.removeEventListener('touchend',    handleEnd);   // eslint-disable-line @typescript-eslint/no-use-before-define
      document.removeEventListener('touchcancel', handleEnd);   // eslint-disable-line @typescript-eslint/no-use-before-define
      cleanupDocListeners.current = null;
    };

    const handleEnd = (e: TouchEvent) => {
      const s = touchState.current;

      let trackedEnded = s.touchId === null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === s.touchId) { trackedEnded = true; break; }
      }
      if (!trackedEnded) return;

      if (s.dragging && s.startId !== null && s.overId !== null) {
        doReorder(s.startId, s.overId);
      }

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
    if (touchState.current.touchId !== null) return;

    const touch = e.touches[0];
    const s = touchState.current;

    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    if (cleanupDocListeners.current) { cleanupDocListeners.current(); }

    s.startId  = id;
    s.startX   = touch.clientX;
    s.startY   = touch.clientY;
    s.moved    = false;
    s.dragging = false;
    s.overId   = null;
    s.touchId  = touch.identifier;

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
        if (!s.dragging) s.touchId = null;
      }
    };
    document.addEventListener('touchmove', cancelOnMove, { passive: true });

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
        s.overId   = id;
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
      // FIX: Never set draggable=true on touch devices.
      // On mobile, draggable=true activates the browser's native HTML5 drag
      // system which competes with our custom touch handlers. When both
      // systems fight over the same gesture (especially with preventDefault
      // on touchmove), the browser input thread can deadlock, freezing the
      // entire page and preventing any further taps or navigation.
      // Desktop-only environments still get draggable=true for mouse support.
      draggable: !isTouchDevice,
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
        // Only block native touch gestures on the item actually being dragged.
        // Using 'none' for all items prevents normal scrolling on touch devices.
        touchAction: isDragging ? 'none' : 'auto',
      },
    };
  }, [draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, onTouchStart]);

  return { getItemProps, draggingId, dragOverId };
}