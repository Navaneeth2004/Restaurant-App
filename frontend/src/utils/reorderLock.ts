/**
 * reorderLock.ts
 *
 * A module-level (singleton) lock that survives React re-renders and is visible
 * to ALL components simultaneously — AdminMenu, WaiterView, etc.
 *
 * When a reorder save is in-flight, any component that calls isLocked() will
 * return true and should skip its socket-triggered reload.
 */

let _locked = false;
let _timer: ReturnType<typeof setTimeout> | null = null;

export const reorderLock = {
  /** Call before sending PATCH /menu/reorder */
  acquire() {
    _locked = true;
    if (_timer) clearTimeout(_timer);
    // Safety release after 10 s in case something throws before release()
    _timer = setTimeout(() => {
      _locked = false;
      _timer = null;
    }, 10_000);
  },

  /** Call after the PATCH resolves (success or failure) */
  release() {
    _locked = false;
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }
  },

  isLocked(): boolean {
    return _locked;
  },
};