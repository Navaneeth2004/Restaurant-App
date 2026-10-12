import { io, Socket } from 'socket.io-client';

// Served from the backend: same origin. In dev, setupProxy.js forwards /socket.io to the backend.
const BACKEND = process.env.REACT_APP_API_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // withCredentials sends the device cookie, which tells the server which restaurant's events we may hear
    socket = io(BACKEND, { transports: ['websocket', 'polling'], withCredentials: true });
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

export function joinStaffRoom(staffId: number, sessionToken: string): void {
  const staffSocket = getSocket();
  staffSocket.emit('staff:join', { staffId, sessionToken }, (result: { ok: boolean }) => {
    if (!result?.ok) console.error('[Socket] Could not join staff room');
  });
}

export function leaveStaffRoom(): void {
  socket?.emit('staff:leave');
}