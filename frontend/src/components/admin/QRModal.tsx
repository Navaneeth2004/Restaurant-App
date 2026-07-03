/**
 * components/admin/QRModal.tsx
 *
 * FIXES:
 * 1. Fetches LAN IP from /api/kiosk/lan-ip so the QR URL uses the server's
 *    192.168.x.x address — works on any phone on the same WiFi.
 * 2. Warning banner is compact (one line) so the modal doesn't get too tall.
 * 3. Falls back to window.location.origin if LAN IP can't be determined.
 */

import React, { useEffect, useState } from 'react';
import { authedJson } from '../../utils/authedFetch';
import QrImage from '../QrImage';
import type { Table } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  table:   Table;
  onClose: () => void;
}

export default function QRModal({ table, onClose }: Props) {
  const [token,    setToken]    = useState<string | null>(null);
  const [lanIp,    setLanIp]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  // Build the kiosk URL using the LAN IP if available, else current origin.
  // Using LAN IP means the QR works on phones connected to the same WiFi.
  const currentPort = window.location.port ? `:${window.location.port}` : '';
  const baseOrigin  = lanIp
    ? `http://${lanIp}${currentPort}`
    : window.location.origin;

  const kioskUrl  = token ? `${baseOrigin}/kiosk/${token}` : null;
  const isLocalhost = !lanIp && window.location.hostname === 'localhost';

  const qrImgSrc = kioskUrl
    ? `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=${encodeURIComponent(kioskUrl)}&choe=UTF-8&chld=M|2`
    : null;

  useEffect(() => {
    (async () => {
      try {
        // Fetch LAN IP and token in parallel
        const [ipData, tokenData] = await Promise.all([
          fetch(`${API_BASE}/api/kiosk/lan-ip`).then(r => r.json()).catch(() => ({ ip: null })),
          authedJson<{ token: string }>(
            `${API_BASE}/api/kiosk/ensure-token`,
            { method: 'POST', body: JSON.stringify({ table_id: table.id }) }
          ),
        ]);
        setLanIp(ipData.ip || null);
        setToken(tokenData.token);
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
      .catch(() => { window.open(qrImgSrc, '_blank'); });
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
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: system-ui, -apple-system, sans-serif; padding: 24px; }
    .card { border: 2px solid #e5e7eb; border-radius: 20px; padding: 32px 28px; text-align: center; width: 340px; }
    img  { width: 220px; height: 220px; display: block; margin: 0 auto 20px; }
    h2   { font-size: 24px; color: #111; margin-bottom: 6px; }
    .sub { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .divider { border: none; border-top: 1px solid #f3f4f6; margin: 20px 0; }
    .hint { font-size: 12px; color: #9ca3af; }
    .seats { display: inline-block; background: #f3f4f6; border-radius: 99px; padding: 3px 10px; font-size: 12px; color: #6b7280; margin-top: 4px; }
    @media print { body { padding: 0; } .card { border: none; } }
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
  <script>window.onload=function(){var img=document.querySelector('img');img.onload=function(){window.print();window.onafterprint=function(){window.close();};};img.onerror=function(){window.print();};};<\/script>
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

        {/* FIX: Compact warning — only shown when LAN IP unavailable, single line */}
        {!loading && !error && isLocalhost && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 mb-3">
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-amber-400 text-[11px] leading-snug">
              No LAN IP found — QR may only work on this PC. Ensure the server is connected to WiFi.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
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
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-100 mb-3">
                <QrImage url={kioskUrl} size={200} />
              </div>

              {/* Table badge + IP badge */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised border border-surface-border">
                  <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18m-9 8h9m-9 4h9M3 14h.01M3 18h.01" />
                  </svg>
                  <span className="text-zinc-300 text-xs font-medium">{table.label}</span>
                  <span className="text-zinc-600 text-xs">·</span>
                  <span className="text-zinc-500 text-xs">{table.seats} seats</span>
                </div>
                {lanIp && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400 text-[10px] font-mono font-semibold">{lanIp}</span>
                  </div>
                )}
              </div>
            </div>

            {/* URL row */}
            <div className="rounded-lg bg-surface-raised border border-surface-border p-3 mb-3">
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">Kiosk URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-zinc-300 text-[11px] break-all font-mono leading-relaxed select-all">
                  {kioskUrl}
                </code>
                <button
                  onClick={copyUrl}
                  className="flex-shrink-0 flex items-center justify-center gap-1 text-[10px] font-medium rounded border border-surface-border transition-colors"
                  style={{ width: 58, height: 28, minWidth: 58 }}
                >
                  {copied ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Copied
                    </span>
                  ) : (
                    <span className="text-zinc-400 hover:text-white flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586" /></svg>
                      Copy
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-lg bg-brand-500/8 border border-brand-500/20 px-3 py-2 mb-3">
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                <span className="text-brand-400 font-semibold">How it works:</span> Customer scans → sees menu → orders → kitchen notified instantly → customer requests bill when done.
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={printQR} className="btn btn-brand btn-sm flex items-center gap-1.5 justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print
              </button>
              <button onClick={downloadQR} className="btn btn-sm flex items-center gap-1.5 justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Save
              </button>
              <button onClick={onClose} className="btn btn-sm justify-center">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}