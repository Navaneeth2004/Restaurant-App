/**
 * components/admin/QRModal.tsx
 *
 * Shows a QR code for a table's kiosk URL.
 * Uses Google Charts QR API (no key, reliable, no dependency).
 * Restaurant can screenshot, download, or print the QR to place on the table.
 */

import React, { useEffect, useState } from 'react';
import { authedJson } from '../../utils/authedFetch';
import type { Table } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  table:   Table;
  onClose: () => void;
}

export default function QRModal({ table, onClose }: Props) {
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  // Use window.location.origin so the URL works on any device on the LAN.
  // When customers scan the QR their phone hits the same server.
  const kioskUrl = token ? `${window.location.origin}/kiosk/${token}` : null;

  // QR image from Google Charts (no API key, 200×200 px, UTF-8 encoded)
  const qrImgSrc = kioskUrl
    ? `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=${encodeURIComponent(kioskUrl)}&choe=UTF-8&chld=M|2`
    : null;

  useEffect(() => {
    (async () => {
      try {
        const data = await authedJson<{ token: string }>(
          `${API_BASE}/api/kiosk/ensure-token`,
          { method: 'POST', body: JSON.stringify({ table_id: table.id }) }
        );
        setToken(data.token);
      } catch (e: any) {
        setError(e.message || 'Failed to generate QR code');
      } finally {
        setLoading(false);
      }
    })();
  }, [table.id]);

  const copyUrl = () => {
    if (!kioskUrl) return;
    navigator.clipboard.writeText(kioskUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadQR = () => {
    if (!qrImgSrc) return;
    // Fetch the image and trigger download
    fetch(qrImgSrc)
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `qr-${table.label.replace(/\s+/g, '-').toLowerCase()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        // Fallback: open in new tab
        window.open(qrImgSrc, '_blank');
      });
  };

  const printQR = () => {
    if (!qrImgSrc || !kioskUrl) return;
    const win = window.open('', '_blank', 'width=420,height=560');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>QR — ${table.label}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #fff;
      font-family: system-ui, -apple-system, sans-serif; padding: 24px;
    }
    .card {
      border: 2px solid #e5e7eb; border-radius: 20px;
      padding: 32px 28px; text-align: center; width: 340px;
    }
    img { width: 220px; height: 220px; display: block; margin: 0 auto 20px; }
    h2  { font-size: 24px; color: #111; margin-bottom: 6px; }
    .sub { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .divider { border: none; border-top: 1px solid #f3f4f6; margin: 20px 0; }
    .hint { font-size: 12px; color: #9ca3af; }
    .seats { display: inline-block; background: #f3f4f6; border-radius: 99px; padding: 3px 10px; font-size: 12px; color: #6b7280; margin-top: 4px; }
    @media print {
      body { padding: 0; }
      .card { border: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${qrImgSrc}" alt="QR Code" />
    <h2>${table.label}</h2>
    <p class="sub">Scan to order &amp; pay</p>
    <span class="seats">${table.seats} seats · Dine in</span>
    <hr class="divider" />
    <p class="hint">Point your phone camera at the QR code</p>
  </div>
  <script>
    window.onload = function() {
      // Wait for image to load before printing
      var img = document.querySelector('img');
      img.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      img.onerror = function() { window.print(); };
    };
  <\/script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-white text-sm">QR Code — {table.label}</h3>
            <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">
              Customers scan this to browse the menu and order from their phone
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-zinc-500 text-xs">Generating QR code…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* QR + actions */}
        {!loading && !error && token && kioskUrl && qrImgSrc && (
          <>
            {/* QR image */}
            <div className="flex flex-col items-center mb-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 mb-3">
                <img
                  src={qrImgSrc}
                  alt={`QR code for ${table.label}`}
                  width={200}
                  height={200}
                  style={{ display: 'block' }}
                  onError={e => {
                    // If Google Charts is unreachable (offline), show a fallback message
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.cssText = 'width:200px;height:200px;display:flex;align-items:center;justify-content:center;text-align:center;color:#6b7280;font-size:12px;font-family:system-ui,sans-serif;padding:16px;';
                    fallback.textContent = 'QR image unavailable offline. Copy the URL below and use a QR generator.';
                    el.parentNode?.insertBefore(fallback, el.nextSibling);
                  }}
                />
              </div>

              {/* Table badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised border border-surface-border">
                <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18m-9 8h9m-9 4h9M3 14h.01M3 18h.01" />
                </svg>
                <span className="text-zinc-300 text-xs font-medium">{table.label}</span>
                <span className="text-zinc-600 text-xs">·</span>
                <span className="text-zinc-500 text-xs">{table.seats} seats</span>
              </div>
            </div>

            {/* URL row */}
            <div className="rounded-lg bg-surface-raised border border-surface-border p-3 mb-4">
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">Kiosk URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-zinc-300 text-[11px] break-all font-mono leading-relaxed select-all">
                  {kioskUrl}
                </code>
                <button
                  onClick={copyUrl}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-lg bg-brand-500/8 border border-brand-500/20 px-3 py-2.5 mb-4">
              <p className="text-zinc-400 text-xs leading-relaxed">
                <span className="text-brand-400 font-semibold">How it works:</span> Customer scans →
                sees your menu → orders → kitchen is notified instantly →
                customer can request the bill when done. No login, no app install.
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={printQR}
                className="btn btn-brand btn-sm flex items-center gap-1.5 justify-center"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print
              </button>
              <button
                onClick={downloadQR}
                className="btn btn-sm flex items-center gap-1.5 justify-center"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Save
              </button>
              <button onClick={onClose} className="btn btn-sm justify-center">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}