/**
 * frontend/src/utils/qrFallback.ts
 *
 * QR code image source helper with a fallback chain:
 *   1. Google Charts API (fast, reliable when internet is available)
 *   2. QRServer.com API (different provider, in case Google is blocked)
 *
 * FIX (#6.1): QRModal.tsx's Print/Download actions previously built their
 * own single hardcoded URL pointing only at chart.googleapis.com (Google's
 * Image Charts API, long since deprecated/unsupported) — if that endpoint
 * is unreachable, printing/downloading silently failed even though the
 * on-screen preview (QrImage.tsx) already had this exact fallback chain
 * and would keep working. Added fetchQrBlobWithFallback() so
 * Print/Download can share the same multi-provider resilience as the
 * on-screen preview.
 */

export function qrSources(url: string, size = 200): string[] {
  const encoded = encodeURIComponent(url);
  return [
    `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}&choe=UTF-8&chld=M|2`,
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`,
  ];
}

/**
 * Tries each QR source in order (fetch-based, for programmatic use like
 * downloading a file) until one succeeds, returning the image Blob.
 * Throws if every provider fails.
 */
export async function fetchQrBlobWithFallback(url: string, size = 256): Promise<Blob> {
  const sources = qrSources(url, size);
  let lastError: unknown = null;
  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } catch (e) {
      lastError = e;
      // try next source
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All QR providers failed');
}