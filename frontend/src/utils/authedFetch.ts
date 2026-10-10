/**
 * utils/authedFetch.ts
 *
 * CLOUD VERSION: the browser no longer fetches or sends an API token. Access is
 * carried by two httpOnly cookies the server sets itself:
 *   - pos_device : this browser is linked to a restaurant (owner login or pairing code)
 *   - pos_staff  : a staff member entered their PIN
 * JavaScript can't read them (so injected scripts can't steal them), and the browser sends
 * them automatically on same-origin requests.
 *
 * getToken()/resetTokenCache() are kept (as no-ops) so existing imports keep compiling.
 *
 * If the server says this device is no longer linked (revoked / suspended) we fire a
 * "pos-device-lost" event and <DeviceGate> shows the connect screen again.
 */

export async function getToken(): Promise<string | null> { return null; }
export function resetTokenCache(): void {}

function notifyIfDeviceLost(res: Response): void {
  if (res.status !== 401 && res.status !== 403) return;
  res.clone().json().then((d: any) => {
    if (d && (d.code === 'device_required' || d.code === 'restaurant_suspended')) {
      window.dispatchEvent(new Event('pos-device-lost'));
    }
  }).catch(() => {});
}

export async function authedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { credentials: 'include', ...opts });
  notifyIfDeviceLost(res);
  return res;
}

export async function authedJson<T = any>(url: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(url, { credentials: 'include', ...opts, headers });
  notifyIfDeviceLost(res);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}