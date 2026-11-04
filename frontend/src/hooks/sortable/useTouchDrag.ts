import { useCallback, useEffect, useRef } from 'react';
import type { SortId } from './reorder';

interface Opts {
  longPressMs: number;
  /** Maps the element under the finger to a sortable id (or null). */
  resolve: (el: Element | null) => SortId | null;
  onStart: (id: SortId) => void;
  onOver: (id: SortId) => void;
  onDrop: (from: SortId, to: SortId) => void;
  onEnd: () => void;
}

const MOVE_TOLERANCE_PX = 8;

/** Long-press then drag with one finger. Page scrolling is blocked ONLY while a drag is active. */
export function useTouchDrag(opts: Opts): (e: React.TouchEvent, id: SortId) => void {
  const latest = useRef(opts);
  useEffect(() => { latest.current = opts; });
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  return useCallback((e, id) => {
    stop.current?.();
    const first = e.touches[0];
    if (!first) return;
    const touchId = first.identifier;
    const startX = first.clientX;
    const startY = first.clientY;
    let dragging = false;
    let over: SortId = id;
    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mine = (list: TouchList): Touch | undefined => Array.from(list).find(t => t.identifier === touchId);

    const finish = (): void => {
      if (timer) clearTimeout(timer);
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('touchmove', idleMove);
      document.removeEventListener('touchmove', dragMove);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', cancel);
      stop.current = null;
      if (dragging) latest.current.onEnd();
    };
    function idleMove(ev: TouchEvent): void {
      const t = mine(ev.touches);
      if (t && Math.hypot(t.clientX - startX, t.clientY - startY) > MOVE_TOLERANCE_PX) finish(); // the user is scrolling
    }
    function dragMove(ev: TouchEvent): void {
      const t = mine(ev.touches);
      if (!t) return;
      ev.preventDefault();
      if (frame !== null) return;
      const { clientX, clientY } = t;
      frame = requestAnimationFrame(() => {
        frame = null;
        const hit = latest.current.resolve(document.elementFromPoint(clientX, clientY));
        if (hit !== null && hit !== over) { over = hit; latest.current.onOver(hit); }
      });
    }
    function end(ev: TouchEvent): void {
      if (!mine(ev.changedTouches)) return;
      if (dragging) latest.current.onDrop(id, over);
      finish();
    }
    function cancel(ev: TouchEvent): void { if (mine(ev.changedTouches)) finish(); }

    document.addEventListener('touchmove', idleMove, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    timer = setTimeout(() => {
      dragging = true;
      document.removeEventListener('touchmove', idleMove);
      document.addEventListener('touchmove', dragMove, { passive: false });
      latest.current.onStart(id);
      navigator.vibrate?.(40);
    }, latest.current.longPressMs);
    stop.current = finish;
  }, []);
}
