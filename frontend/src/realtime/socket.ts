import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from 'config/env';
import { CLIENT_EVENTS } from 'config/events';

/** The ONE socket connection of the app. Staff app: cookies. Kiosk page: auth.kiosk token. */
let socket: Socket | null = null;
let kioskToken: string | null = null;

declare global {
  interface Window { __pos_socket_connected?: boolean }
}

export function setKioskToken(token: string | null): void {
  if (kioskToken !== token) closeSocket();
  kioskToken = token;
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_ORIGIN, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    ...(kioskToken ? { auth: { kiosk: kioskToken } } : {}),
  });
  socket.on('connect', () => { window.__pos_socket_connected = true; });
  socket.on('disconnect', () => { window.__pos_socket_connected = false; });
  return socket;
}

export function closeSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  window.__pos_socket_connected = false;
}

/** Asks the server to (re)join the staff room. Resolves false if refused or the ack never comes. */
export function joinStaffRoom(staffId: number, sessionToken: string): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    getSocket().emit(CLIENT_EVENTS.joinStaff, { staffId, sessionToken }, (ack: { ok?: boolean } | undefined) => {
      clearTimeout(timer);
      resolve(ack?.ok === true);
    });
  });
}

export function leaveStaffRoom(): void {
  socket?.emit(CLIENT_EVENTS.leaveStaff);
}
