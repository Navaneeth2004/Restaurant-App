import { request } from '../http';
import type { DeviceStatus, OwnerLoginResponse, RegisterInput } from 'types/core/auth';

const pub = { scope: 'public' } as const;

export const getDeviceStatus = (signal?: AbortSignal) =>
  request<DeviceStatus>('/auth/device/status', { ...pub, signal });

export const ownerLogin = (b: { phone: string; password: string; restaurant_id?: string; device_name?: string }) =>
  request<OwnerLoginResponse>('/auth/owner/login', { ...pub, method: 'POST', json: b });

export const ownerRegister = (b: RegisterInput) =>
  request<{ linked: boolean }>('/auth/owner/register', { ...pub, method: 'POST', json: b });

export const pairDevice = (b: { code: string; device_name?: string }) =>
  request<{ linked: boolean }>('/auth/device/pair', { ...pub, method: 'POST', json: b });

export const unlinkDevice = (pin: string) =>
  request<void>('/auth/device/unlink', { method: 'POST', json: { pin } });
