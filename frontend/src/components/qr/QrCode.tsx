import { useEffect, useState } from 'react';
import { qrDataUrl } from 'lib/browser/qr';

interface Props { value: string; size?: number; className?: string }

/** Local QR image. Shows a fixed-size placeholder while rendering and a text fallback if it cannot be drawn. */
export default function QrCode({ value, size = 200, className }: Props) {
  const [state, setState] = useState<{ value: string; src: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    qrDataUrl(value, size * 2)
      .then(src => { if (live) setState({ value, src }); })
      .catch(() => { if (live) setState({ value, src: null }); });
    return () => { live = false; };
  }, [value, size]);

  const ready = state && state.value === value ? state : null;
  const box = { width: size, height: size };
  if (!ready) return <div className={className} style={box} aria-busy="true" />;
  if (!ready.src) {
    return <div className={`flex items-center justify-center text-center text-xs text-zinc-500 ${className ?? ''}`} style={box}>Could not draw the QR code — copy the link instead.</div>;
  }
  return <img src={ready.src} alt="QR code" width={size} height={size} className={className} style={{ display: 'block' }} />;
}
