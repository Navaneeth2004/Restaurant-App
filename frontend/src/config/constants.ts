export const ROLES = ['admin', 'waiter', 'kitchen'] as const;
export type Role = typeof ROLES[number];

export const ORDER_STATUSES = ['active', 'delivered', 'billed_direct', 'closed'] as const;
export const TABLE_STATUSES = ['empty', 'occupied', 'waiting_bill'] as const;

/** Mirror of the backend STAFF_SESSION_DAYS: a staff session expires on the server after this long. */
export const STAFF_SESSION_DAYS = 7;
export const HEARTBEAT_MS = 30_000;
export const DEVICE_STATUS_POLL_MS = 60_000;
/** Safety net for a customer phone whose live connection silently dropped. */
export const KIOSK_POLL_MS = 30_000;
export const KITCHEN_NOTICE_TTL_MS = 5 * 60_000;
export const REORDER_SETTLE_MS = 1_500;
export const DEFAULT_OVERDUE_MINS = 20;
/** Largest `limit` the history endpoint accepts. */
/** First financial year offered in the GSTR-9 picker. */
export const FIRST_FY_YEAR = 2023;
export const REPORT_HISTORY_LIMIT = 1000;
export const ANALYTICS_REFRESH_MS = 400;
export const MAX_PIN_LENGTH = 6;
export const MIN_PIN_LENGTH = 4;

export const LIMITS = {
  restaurantName: 60,
  phone: 20,
  address: 120,
  billFooter: 150,
  currencySymbol: 4,
  legalName: 100,
  sacCode: 8,
  gstin: 15,
  taxMin: 0,
  taxMax: 100,
  overdueMin: 1,
  overdueMax: 240,
} as const;

export const OVERDUE_PRESETS: ReadonlyArray<number> = [10, 15, 20, 30, 45, 60];
export const BRAND_PRESETS: ReadonlyArray<string> = ['#f97316', '#e11d48', '#8b5cf6', '#0ea5e9', '#10b981', '#eab308', '#6366f1', '#f43f5e', '#0f172a'];
export const LOCK_TIMEOUTS: ReadonlyArray<{ mins: number; label: string }> = [
  { mins: 0, label: 'Always ask' }, { mins: 2, label: '2 minutes' }, { mins: 5, label: '5 minutes' },
  { mins: 10, label: '10 minutes' }, { mins: 30, label: '30 minutes' },
];

/** The server silently drops a ticket screenshot above 4 MB (and anything that is not PNG/JPEG): stay below it. */
export const MAX_SCREENSHOT_BYTES = 3.5 * 1024 * 1024;
export const SCREENSHOT_MAX_SIDE = 1600;
/** Largest backup the server accepts (backup.js: makeMemoryUploader(60)). */
export const MAX_BACKUP_MB = 60;
export const RESET_PHRASE = 'RESET EVERYTHING';
export const APP_VERSION = '1.0.0';
