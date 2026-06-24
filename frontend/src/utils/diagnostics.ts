/**
 * utils/diagnostics.ts
 *
 * Auto-collects device/browser/app context for bug reports.
 * Also captures console errors globally (call startErrorCapture() once on app boot).
 * Extracted from BugReportView.tsx.
 *
 * FIX: Restored console.error monkey-patching, but in a way that avoids the
 * React StrictMode double-invocation problem. The old removal left users with
 * no captured errors in bug reports because window 'error' and 'unhandledrejection'
 * only fire for uncaught exceptions — deliberate console.error() calls (which is
 * what almost all caught/handled errors use) were silently dropped.
 *
 * The fix wraps console.error so entries ARE captured, but uses a deduplication
 * check to avoid duplicate entries from React StrictMode's double-render. We also
 * still keep the window-level listeners for truly uncaught throws.
 */

// ── Console error capture ─────────────────────────────────────────────────

const _capturedErrors: string[] = [];
let _capturing = false;

/**
 * Call once at app startup (e.g. in index.tsx) to begin capturing errors.
 * Safe to call multiple times — only installs listeners once.
 */
export function startErrorCapture(): void {
  if (_capturing) return;
  _capturing = true;

  // ── Patch console.error ──────────────────────────────────────────────
  // This is the primary capture path: almost all app errors go through
  // console.error (axios interceptors, caught promise rejections that are
  // deliberately logged, React error boundaries, etc.).
  //
  // React StrictMode calls renders twice in dev, but it does NOT double-call
  // console.error for the same error — the duplicate guard below is just
  // extra safety for edge cases.
  const origError = console.error.bind(console);
  console.error = (...args: any[]) => {
    // Build a string representation of the error
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');

    const entry = `[${new Date().toISOString()}] console.error: ${msg}`;

    // Dedup: skip if the last captured entry is identical (StrictMode guard)
    if (_capturedErrors.length === 0 || _capturedErrors[_capturedErrors.length - 1] !== entry) {
      _capturedErrors.push(entry);
      if (_capturedErrors.length > 30) _capturedErrors.shift();
    }

    // Always call the original so DevTools still shows the error
    origError(...args);
  };

  // ── window 'error' ── uncaught exceptions (throws that escape all try/catch)
  window.addEventListener('error', e => {
    const entry = `[${new Date().toISOString()}] Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`;
    if (_capturedErrors.length === 0 || _capturedErrors[_capturedErrors.length - 1] !== entry) {
      _capturedErrors.push(entry);
      if (_capturedErrors.length > 30) _capturedErrors.shift();
    }
  });

  // ── window 'unhandledrejection' ── promise rejections with no .catch()
  window.addEventListener('unhandledrejection', e => {
    const entry = `[${new Date().toISOString()}] UnhandledPromise: ${e.reason}`;
    if (_capturedErrors.length === 0 || _capturedErrors[_capturedErrors.length - 1] !== entry) {
      _capturedErrors.push(entry);
      if (_capturedErrors.length > 30) _capturedErrors.shift();
    }
  });
}

export function getCapturedErrors(): string[] {
  return [..._capturedErrors];
}

// ── Diagnostics collector ─────────────────────────────────────────────────

export interface DiagnosticsPayload {
  appContext: {
    currentView: string;
    userRole: string;
    userName: string;
    userId: number | string;
    selectedTable: string | null;
    url: string;
    sessionDuration: string;
    sessionStart: string;
    timestamp: string;
  };
  device: {
    browser: string;
    browserVersion: string;
    os: string;
    type: string;
    userAgent: string;
    screen: string;
    viewport: string;
    devicePixelRatio: number;
    touch: boolean;
    timezone: string;
    language: string;
    languages: string;
    memory: number | null;
    cores: number | null;
    cookiesEnabled: boolean;
    onLine: boolean;
  };
  network: {
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } | null;
  performance: {
    pageLoad: number | null;
    domReady: number | null;
    memoryUsed: string | null;
  };
  consoleErrors: string[];
  socketConnected: boolean;
}

export function collectDiagnostics(
  user: { id: number | string; name: string; role: string } | null,
  currentView: string,
  sessionStart: Date
): DiagnosticsPayload {
  const ua = navigator.userAgent;

  // Browser detection
  let browser = 'Unknown';
  let browserVersion = '';
  const bMatches: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Safari\/([\d.]+)/, 'Safari'],
  ];
  for (const [re, name] of bMatches) {
    const m = ua.match(re);
    if (m) { browser = name; browserVersion = m[1]; break; }
  }

  // OS detection
  let os = 'Unknown';
  if (/Windows NT 10/.test(ua))           os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua))    os = 'Windows 8.1';
  else if (/Windows/.test(ua))            os = 'Windows';
  else if (/Mac OS X ([\d_]+)/.test(ua))  os = `macOS ${ua.match(/Mac OS X ([\d_]+)/)![1].replace(/_/g, '.')}`;
  else if (/Android ([\d.]+)/.test(ua))   os = `Android ${ua.match(/Android ([\d.]+)/)![1]}`;
  else if (/iPhone OS ([\d_]+)/.test(ua)) os = `iOS ${ua.match(/iPhone OS ([\d_]+)/)![1].replace(/_/g, '.')}`;
  else if (/Linux/.test(ua))              os = 'Linux';

  const isMobile  = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isTablet  = /iPad|tablet/i.test(ua);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';

  const nav  = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  const perf   = window.performance;
  const timing = (perf as any)?.timing;
  let pageLoad: number | null = null;
  let domReady: number | null = null;
  if (timing?.loadEventEnd && timing?.navigationStart) {
    pageLoad = Math.round(timing.loadEventEnd       - timing.navigationStart);
    domReady = Math.round(timing.domContentLoadedEventEnd - timing.navigationStart);
  }

  const mem = (performance as any).memory;

  const sessionDurationMs = Date.now() - sessionStart.getTime();
  const sessionMins = Math.floor(sessionDurationMs / 60000);
  const sessionSecs = Math.floor((sessionDurationMs % 60000) / 1000);

  return {
    appContext: {
      currentView,
      userRole:        user?.role     || 'unknown',
      userName:        user?.name     || 'unknown',
      userId:          user?.id       || 'unknown',
      selectedTable:   null,
      url:             window.location.href,
      sessionDuration: `${sessionMins}m ${sessionSecs}s`,
      sessionStart:    sessionStart.toISOString(),
      timestamp:       new Date().toISOString(),
    },
    device: {
      browser,
      browserVersion,
      os,
      type:              deviceType,
      userAgent:         ua,
      screen:            `${window.screen.width}×${window.screen.height} (${window.screen.colorDepth}bit)`,
      viewport:          `${window.innerWidth}×${window.innerHeight}`,
      devicePixelRatio:  window.devicePixelRatio,
      touch:             'ontouchstart' in window || navigator.maxTouchPoints > 0,
      timezone:          Intl.DateTimeFormat().resolvedOptions().timeZone,
      language:          navigator.language,
      languages:         navigator.languages?.join(', ') ?? '',
      memory:            nav.deviceMemory ?? null,
      cores:             navigator.hardwareConcurrency ?? null,
      cookiesEnabled:    navigator.cookieEnabled,
      onLine:            navigator.onLine,
    },
    network: conn
      ? { effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt, saveData: conn.saveData }
      : null,
    performance: {
      pageLoad,
      domReady,
      memoryUsed: mem
        ? `${Math.round(mem.usedJSHeapSize / 1048576)}MB / ${Math.round(mem.jsHeapSizeLimit / 1048576)}MB`
        : null,
    },
    consoleErrors:   getCapturedErrors(),
    socketConnected: !!(window as any).__pos_socket_connected,
  };
}

// ── Screenshot capture ────────────────────────────────────────────────────

/**
 * Asks the user to share their screen, captures a single frame, and returns
 * it as a base64 PNG data URL. Returns null if the user cancels or the
 * browser doesn't support getDisplayMedia.
 */
export async function captureScreenshot(): Promise<string | null> {
  try {
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
    const video  = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}