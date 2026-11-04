import QRCode from 'qrcode';

/** Renders a QR code to a PNG data URL ENTIRELY in the browser. The text (a kiosk or pairing link) never leaves the device. */
export function qrDataUrl(text: string, size = 256): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' });
}
