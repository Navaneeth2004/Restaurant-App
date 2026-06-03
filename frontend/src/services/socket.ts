import { io, Socket } from 'socket.io-client';

// In production (served from backend), connect to same origin.
// In dev, use REACT_APP_API_URL.
const BACKEND = process.env.REACT_APP_API_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => console.log('[Socket] Connected', socket?.id));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) { socket.disconnect(); socket = null; }
}
