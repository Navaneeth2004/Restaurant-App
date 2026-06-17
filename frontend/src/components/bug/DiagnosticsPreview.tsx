/**
 * components/bug/DiagnosticsPreview.tsx
 *
 * Collapsible panel showing auto-collected device/browser diagnostics
 * inside the bug report form.
 * Extracted from BugReportView.tsx.
 */

import React, { useState } from 'react';
import type { DiagnosticsPayload } from '../../utils/diagnostics';

interface Props {
  diag: DiagnosticsPayload;
}

export default function DiagnosticsPreview({ diag }: Props) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: 'Browser',       value: `${diag.device.browser} ${diag.device.browserVersion}` },
    { label: 'OS',            value: diag.device.os },
    { label: 'Device',        value: `${diag.device.type} · ${diag.device.screen}` },
    { label: 'Viewport',      value: diag.device.viewport },
    { label: 'Timezone',      value: diag.device.timezone },
    { label: 'View',          value: diag.appContext.currentView },
    { label: 'Role',          value: diag.appContext.userRole },
    { label: 'Session',       value: diag.appContext.sessionDuration },
    { label: 'Errors caught', value: String(diag.consoleErrors.length) },
    { label: 'Online',        value: diag.device.onLine ? 'Yes' : 'No' },
  ];

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-card/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-zinc-300 text-sm font-semibold leading-tight">Auto-collected diagnostics</p>
            <p className="text-zinc-500 text-[10px] leading-tight mt-0.5">
              {diag.consoleErrors.length > 0
                ? `${diag.consoleErrors.length} error${diag.consoleErrors.length !== 1 ? 's' : ''} captured · tap to review`
                : 'Device, browser & session info ready'}
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-surface-border px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mb-3">
            {items.map(({ label, value }) => (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
                <p className="text-xs text-zinc-300 font-medium truncate">{value || '—'}</p>
              </div>
            ))}
          </div>

          {diag.consoleErrors.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-500 mb-1.5">
                Captured Errors ({diag.consoleErrors.length})
              </p>
              <div className="bg-zinc-900 rounded-lg p-2.5 max-h-32 overflow-y-auto">
                {diag.consoleErrors.map((err, i) => (
                  <p key={i} className="text-[10px] font-mono text-red-400 leading-relaxed">{err}</p>
                ))}
              </div>
            </div>
          )}

          <p className="text-zinc-700 text-[10px] mt-2">
            All of this is sent with your report automatically. You don't need to describe your device.
          </p>
        </div>
      )}
    </div>
  );
}