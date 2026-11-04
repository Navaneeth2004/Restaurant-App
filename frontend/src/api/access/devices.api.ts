import { request } from '../http';
import type { Device, PairingCode } from 'types/core/auth';

export const listDevices = (signal?: AbortSignal) => request<Device[]>('/auth/devices', { signal });
export const createPairingCode = (roleLock: string | null) =>
  request<PairingCode>('/auth/pairing-code', { method: 'POST', json: { role_lock: roleLock } });
export const removeDevice = (id: string) => request<void>(`/auth/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
