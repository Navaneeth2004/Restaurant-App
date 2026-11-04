/* eslint-disable no-console -- this module exists to wrap console.error so tickets can include recent errors */
const MAX_ENTRIES = 30;
const MAX_LENGTH = 600; // the server clips each entry to this too

const entries: string[] = [];
let lastMessage = '';
let stop: (() => void) | null = null;

function describe(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === 'object' && arg !== null) {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

/** Keeps the last 30 distinct errors. A message repeated back-to-back (React StrictMode, retry loops) is stored once. */
export function recordError(message: string, now: Date = new Date()): void {
  if (message === lastMessage) return;
  lastMessage = message;
  entries.push(`[${now.toISOString()}] ${message}`.slice(0, MAX_LENGTH));
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export const getCapturedErrors = (): string[] => [...entries];
export const clearCapturedErrors = (): void => { entries.length = 0; lastMessage = ''; };

/** Call once at app start so a ticket can carry what went wrong BEFORE the form was opened. Safe to call twice. */
export function startErrorCapture(): void {
  if (stop) return;
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    recordError(`console.error: ${args.map(describe).join(' ')}`);
    original.apply(console, args);
  };
  const onError = (e: ErrorEvent): void => recordError(`Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  const onRejection = (e: PromiseRejectionEvent): void => recordError(`UnhandledPromise: ${describe(e.reason)}`);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  stop = () => {
    console.error = original;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    stop = null;
  };
}

export function stopErrorCapture(): void { stop?.(); }
