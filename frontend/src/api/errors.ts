export type ErrorExtra = Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly extra: ErrorExtra;

  constructor(status: number, message: string, code?: string, extra: ErrorExtra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }

  /** Seconds (backend sends retry_after in SECONDS everywhere). */
  get retryAfter(): number | null {
    const v = this.extra.retry_after;
    return typeof v === 'number' && v > 0 ? v : null;
  }
  get staffName(): string | null {
    return typeof this.extra.staffName === 'string' ? this.extra.staffName : null;
  }
  get sessionChanged(): boolean { return this.extra.session_changed === true; }
  get isNetwork(): boolean { return this.status === 0; }
  get isLocked(): boolean { return this.status === 429 && this.code === 'locked'; }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export const GENERIC_SERVER_ERROR = 'Something went wrong on the server. Please try again.';
export const NETWORK_ERROR = 'Cannot reach the server. Check your internet connection.';

/** One place that turns any thrown value into text for the user. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isApiError(e)) return fallback;
  if (e.isNetwork) return NETWORK_ERROR;
  if (e.status === 409 && e.staffName) return `${e.staffName} is already logged in on another device`;
  if (e.isLocked) {
    const s = e.retryAfter;
    return s ? `${e.message} Try again in ${s} second${s === 1 ? '' : 's'}.` : e.message;
  }
  if (e.status === 403 && e.code === 'forbidden') return e.message || 'You do not have permission to do that.';
  if (e.status >= 500) return GENERIC_SERVER_ERROR;
  return e.message || fallback;
}
