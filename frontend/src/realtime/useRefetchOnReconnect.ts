import { useEffect, useRef } from 'react';
import { getSocket } from './socket';

/** Events may be missed while offline: call `refetch` on every RE-connect (not the first connect). */
export function useRefetchOnReconnect(refetch: () => void): void {
  const ref = useRef(refetch);
  useEffect(() => { ref.current = refetch; });

  useEffect(() => {
    const socket = getSocket();
    let seenFirstConnect = socket.connected;
    const onConnect = (): void => {
      if (seenFirstConnect) ref.current();
      seenFirstConnect = true;
    };
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, []);
}
