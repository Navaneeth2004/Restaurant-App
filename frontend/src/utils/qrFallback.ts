/**
 * frontend/src/utils/qrFallback.ts
 *
 * QR code image source helper with a fallback chain:
 *   1. Google Charts API (fast, reliable when internet is available)
 *   2. QRServer.com API (different provider, in case Google is blocked
 *      but the QRServer domain isn't — different CDNs are sometimes
 *      reachable when others aren't, e.g. some captive portals/firewalls)
 *
 * If both fail (genuinely offline LAN with no internet at all), callers
 * should catch the onError of the final <img> and show a "copy link"
 * fallback UI instead — there is no way to render a QR with zero internet
 * and zero extra npm dependencies, so this is the best-effort chain.
 */

export function qrSources(url: string, size = 200): string[] {
  const encoded = encodeURIComponent(url);
  return [
    `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}&choe=UTF-8&chld=M|2`,
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`,
  ];
}