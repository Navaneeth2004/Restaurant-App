import { API_BASE } from 'config/env';
import { WINDOW_EVENTS } from 'config/events';
import { ApiError, ErrorExtra, NETWORK_ERROR } from './errors';

export type Scope = 'app' | 'root' | 'public';
export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  json?: unknown;
  /** Multipart: Content-Type is set by the browser, never by us. */
  form?: FormData;
  signal?: AbortSignal;
  scope?: Scope;
}

export interface FailureDetail { code?: string; message: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  const rec = isRecord(body) ? body : {};
  const { error, code, ...rest } = rec;
  const message = typeof error === 'string' && error ? error : `Request failed (${res.status})`;
  return new ApiError(res.status, message, typeof code === 'string' ? code : undefined, rest as ErrorExtra);
}

/** Central 401/403 policy. Layers above subscribe to these window events. */
export function dispatchFailure(err: ApiError, scope: Scope): void {
  const detail: FailureDetail = { code: err.code, message: err.message };
  const fire = (name: string): void => { window.dispatchEvent(new CustomEvent<FailureDetail>(name, { detail })); };
  if (scope === 'root') {
    if (err.status === 401) fire(WINDOW_EVENTS.rootAuthLost);
    return;
  }
  if (scope !== 'app') return;
  if (err.status === 401 && err.code === 'device_required') fire(WINDOW_EVENTS.deviceLost);
  else if (err.status === 401 && err.code === 'staff_required') fire(WINDOW_EVENTS.staffRequired);
  else if (err.status === 403 && err.code === 'restaurant_suspended') fire(WINDOW_EVENTS.deviceLost);
  else if (err.status === 403 && err.code === 'forbidden') fire(WINDOW_EVENTS.forbidden);
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const scope = opts.scope ?? 'app';
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET', headers, body, signal: opts.signal, credentials: 'include', cache: 'no-store',
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (!res.ok) {
    const err = await toApiError(res);
    dispatchFailure(err, scope);
    throw err;
  }
  return res;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function requestBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  return (await send(path, opts)).blob();
}

export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';
