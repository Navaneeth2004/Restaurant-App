import type { DiagnosticsPayload } from 'types/office/support';
import { getCapturedErrors } from './error-capture';

// Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg\/([\d.]+)/, 'Edge'], [/OPR\/([\d.]+)/, 'Opera'], [/CriOS\/([\d.]+)/, 'Chrome'], [/FxiOS\/([\d.]+)/, 'Firefox'],
  [/Chrome\/([\d.]+)/, 'Chrome'], [/Firefox\/([\d.]+)/, 'Firefox'], [/Version\/([\d.]+).*Safari/, 'Safari'], [/Safari\/([\d.]+)/, 'Safari'],
];

export function detectBrowser(ua: string): { name: string; version: string } {
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] };
  }
  return { name: 'Unknown', version: '' };
}

/** iPhone/iPad/Android are checked before macOS/Linux: their user agents also say "like Mac OS X" / "Linux". */
export function detectOs(ua: string): string {
  const ios = ua.match(/(?:iPhone|CPU) OS ([\d_]+)/);
  if (/iPhone|iPad/.test(ua) && ios) return `iOS ${ios[1].replace(/_/g, '.')}`;
  const android = ua.match(/Android ([\d.]+)/);
  if (android) return `Android ${android[1]}`;
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1';
  if (/Windows/.test(ua)) return 'Windows';
  const mac = ua.match(/Mac OS X ([\d_]+)/);
  if (mac) return `macOS ${mac[1].replace(/_/g, '.')}`;
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

export function detectDeviceType(ua: string): string {
  if (/iPad|tablet/i.test(ua)) return 'Tablet';
  return /Mobi|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop';
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const prop = (o: unknown, k: string): unknown => (typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined);

function networkInfo(): DiagnosticsPayload['network'] {
  const c = Reflect.get(navigator, 'connection');
  if (typeof c !== 'object' || c === null) return null;
  return { effectiveType: String(prop(c, 'effectiveType') ?? ''), downlink: num(prop(c, 'downlink')) ?? 0, rtt: num(prop(c, 'rtt')) ?? 0, saveData: prop(c, 'saveData') === true };
}

function loadTimings(): { pageLoad: number | null; domReady: number | null } {
  if (typeof PerformanceNavigationTiming === 'undefined') return { pageLoad: null, domReady: null };
  const nav = performance.getEntriesByType('navigation')[0];
  if (!(nav instanceof PerformanceNavigationTiming) || nav.loadEventEnd <= 0) return { pageLoad: null, domReady: null };
  return { pageLoad: Math.round(nav.loadEventEnd), domReady: Math.round(nav.domContentLoadedEventEnd) };
}

function heapUsed(): string | null {
  const mem = Reflect.get(performance, 'memory');
  const used = num(prop(mem, 'usedJSHeapSize'));
  const limit = num(prop(mem, 'jsHeapSizeLimit'));
  return used === null || limit === null ? null : `${Math.round(used / 1048576)}MB / ${Math.round(limit / 1048576)}MB`;
}

interface Who { id: number | string; name: string; role: string }

/**
 * Snapshot of device, page and captured errors. "sessionDuration" is how long this PAGE has been open
 * (the app keeps no other clock), and `currentView` is the screen the person was on before opening the ticket form.
 */
export function collectDiagnostics(user: Who | null, currentView: string, now: Date = new Date()): DiagnosticsPayload {
  const ua = navigator.userAgent;
  const browser = detectBrowser(ua);
  const opened = new Date(performance.timeOrigin);
  return {
    appContext: {
      currentView, userRole: user?.role ?? 'unknown', userName: user?.name ?? 'unknown', userId: user?.id ?? 'unknown', url: window.location.href,
      sessionDuration: formatDuration(now.getTime() - opened.getTime()), sessionStart: opened.toISOString(), timestamp: now.toISOString(),
    },
    device: {
      browser: browser.name, browserVersion: browser.version, os: detectOs(ua), type: detectDeviceType(ua), userAgent: ua,
      screen: `${window.screen.width}×${window.screen.height} (${window.screen.colorDepth}bit)`, viewport: `${window.innerWidth}×${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio, touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: navigator.language, languages: (navigator.languages ?? []).join(', '),
      memory: num(Reflect.get(navigator, 'deviceMemory')), cores: num(navigator.hardwareConcurrency), cookiesEnabled: navigator.cookieEnabled, onLine: navigator.onLine,
    },
    network: networkInfo(),
    performance: { ...loadTimings(), memoryUsed: heapUsed() },
    consoleErrors: getCapturedErrors(),
    socketConnected: window.__pos_socket_connected === true,
  };
}
