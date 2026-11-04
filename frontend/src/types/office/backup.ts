/** `POST /backup/restore` answer: a sentence such as "Restored. 3 images restored. Everyone must log in again." */
export interface RestoreResult { success?: boolean; message?: string; images_restored?: number }
