/**
 * frontend/src/components/QrImage.tsx
 *
 * Renders a QR code image, trying multiple providers in sequence before
 * falling back to a "copy link" prompt. Used by QRModal and ParcelModal
 * so the multi-provider fallback logic lives in one place.
 */

import React, { useState, useEffect } from 'react';
import { qrSources } from '../utils/qrFallback';

interface Props {
  url:        string;
  size?:      number;
  className?: string;
  style?:     React.CSSProperties;
}

export default function QrImage({ url, size = 200, className, style }: Props) {
  const sources = qrSources(url, size);
  const [srcIdx,  setSrcIdx]  = useState(0);
  const [failed,  setFailed]  = useState(false);

  // Reset when the URL changes (e.g. new table/parcel slot)
  useEffect(() => { setSrcIdx(0); setFailed(false); }, [url]);

  const handleError = () => {
    if (srcIdx < sources.length - 1) {
      setSrcIdx(i => i + 1);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div
        className={className}
        style={{
          width: size, height: size, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          background: '#f3f4f6', borderRadius: 8, padding: 12, gap: 4,
          ...style,
        }}
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        </svg>
        <p style={{ fontSize: 11, color: '#6b7280', fontFamily: 'system-ui,-apple-system,sans-serif', margin: 0, lineHeight: 1.4 }}>
          No internet — copy the link below instead
        </p>
      </div>
    );
  }

  return (
    <img
      src={sources[srcIdx]}
      alt="QR code"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
      onError={handleError}
    />
  );
}