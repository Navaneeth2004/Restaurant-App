import { RESET_PHRASE } from 'config/constants';
import type { RestoreResult } from 'types/office/backup';
import { request, requestBlob } from '../http';

/** The backup is a zip of this restaurant's database and photos. (The server has no local-folder or Drive backup.) */
export const downloadBackup = () => requestBlob('/backup/download');
export const restoreBackup = (file: File) => {
  const form = new FormData();
  form.append('backup', file);
  return request<RestoreResult>('/backup/restore', { method: 'POST', form });
};
/** Wipes orders, history, photos, menu, tables and settings of THIS restaurant. Staff accounts are kept. */
export const factoryReset = () => request<{ message?: string }>('/reset', { method: 'POST', json: { confirm: RESET_PHRASE } });
