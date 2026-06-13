import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';

export function useSocket(event: string, handler: (...args: any[]) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const stable = (...args: any[]) => handlerRef.current(...args);
    socket.on(event, stable);
    return () => { socket.off(event, stable); };
  }, [event]);
}