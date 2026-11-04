import { request } from '../http';
import type { Settings, SettingsPatch } from 'types/core/settings';

export const getSettings = (signal?: AbortSignal) => request<Settings>('/settings', { signal });
export const updateSettings = (patch: SettingsPatch | { admin_lock_config: string }) =>
  request<void>('/settings', { method: 'PUT', json: patch });
export const uploadLogo = (file: File) => {
  const form = new FormData();
  form.append('logo', file);
  return request<{ logo_url: string }>('/settings/logo', { method: 'POST', form });
};
