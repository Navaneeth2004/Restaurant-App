import { io, Socket } from 'socket.io-client';

// In production (served from backend), connect to same origin.
// In dev, use REACT_APP_API_URL.
const BACKEND = process.env.REACT_APP_API_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND, { transports: ['websocket', 'polling'] });
    // FIX (#6.2): diagnostics.ts reads window.__pos_socket_connected for
    // bug-report diagnostics, but nothing anywhere ever set it — every
    // report showed the socket as disconnected regardless of actual
    // state. Set it here so it reflects reality.
    socket.on('connect', () => {
      (window as any).__pos_socket_connected = true;
      console.log('[Socket] Connected', socket?.id);
    });
    socket.on('disconnect', () => {
      (window as any).__pos_socket_connected = false;
      console.log('[Socket] Disconnected');
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    (window as any).__pos_socket_connected = false;
  }
}