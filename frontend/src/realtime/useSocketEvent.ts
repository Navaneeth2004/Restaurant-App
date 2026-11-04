import { useEffect, useRef } from 'react';
import type { EventName } from 'config/events';
import { getSocket } from './socket';

/** Subscribes for the lifetime of the component. The handler may change every render without re-subscribing. */
export function useSocketEvent<T = void>(event: EventName, handler: (payload: T) => void): void {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });

  useEffect(() => {
    const socket = getSocket();
    const listener = (payload: T): void => ref.current(payload);
    socket.on(event, listener);
    return () => { socket.off(event, listener); };
  }, [event]);
}
