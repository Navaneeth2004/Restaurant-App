import { request } from '../http';
import type { Role } from 'config/constants';
import type { Staff, StaffLoginResponse } from 'types/core/auth';

export const verifyPin = (pin: string, currentSessionToken?: string | null) =>
  request<StaffLoginResponse>('/staff/verify', { method: 'POST', json: { pin, currentSessionToken: currentSessionToken ?? undefined } });

export const checkPin = async (pin: string): Promise<boolean> =>
  (await request<{ valid: boolean }>('/staff/check-pin', { method: 'POST', json: { pin } })).valid === true;

/** POST with a body: the session token must never appear in a URL (it would end up in server logs). */
export const validateSession = (staffId: number, sessionToken: string, signal?: AbortSignal) =>
  request<{ valid: boolean }>('/staff/session/validate', { method: 'POST', json: { staffId, sessionToken }, signal });

export const logoutStaff = (staffId: number, sessionToken: string) =>
  request<void>('/staff/logout', { method: 'POST', json: { staffId, sessionToken } });

export const listStaff = (signal?: AbortSignal) => request<Staff[]>('/staff', { signal });
export const createStaff = (b: { name: string; pin: string; role: Role }) =>
  request<Staff>('/staff', { method: 'POST', json: b });
export const changeStaffPin = (id: number, pin: string) =>
  request<void>(`/staff/${id}`, { method: 'PUT', json: { pin } });
export const deleteStaff = (id: number) => request<void>(`/staff/${id}`, { method: 'DELETE' });
