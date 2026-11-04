import { MAX_SCREENSHOT_BYTES, SCREENSHOT_MAX_SIDE } from 'config/constants';

/** Size that fits inside `max` on the longer side, never enlarging. */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Decoded size of a base64 data URL. */
export function dataUrlBytes(url: string): number {
  const comma = url.indexOf(',');
  const b64 = comma < 0 ? url : url.slice(comma + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

const QUALITIES = [0.85, 0.7, 0.5, 0.35];

/** JPEG data URL under the server's limit (lowering quality as needed), or null if even the lowest quality is too large. */
export function encodeJpeg(canvas: Pick<HTMLCanvasElement, 'toDataURL'>, maxBytes: number = MAX_SCREENSHOT_BYTES): string | null {
  for (const q of QUALITIES) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (dataUrlBytes(url) <= maxBytes) return url;
  }
  return null;
}

function draw(source: CanvasImageSource, w: number, h: number): string | null {
  const size = fitSize(w, h, SCREENSHOT_MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return encodeJpeg(canvas);
}

/**
 * Asks the user to share a screen/window/tab and grabs one frame. Null if cancelled, unsupported or too big.
 * The capture stream is ALWAYS stopped, also when something throws half-way.
 */
export async function captureScreen(): Promise<string | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  let stream: MediaStream | null = null;
  const video = document.createElement('video');
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    return draw(video, video.videoWidth, video.videoHeight);
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
}

/** Any image the browser can show (png, jpg, webp, gif…) → a JPEG the server accepts. Null if unreadable or too big. */
export async function imageFileToJpeg(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const url = draw(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return url;
  } catch { return null; }
}
