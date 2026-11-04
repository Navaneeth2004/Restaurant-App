import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import type { DiagnosticsPayload } from 'types/office/support';

/** What is sent automatically with the ticket. Collapsed by default; errors are shown so nothing is sent unseen. */
export default function DiagnosticsPreview({ diag }: { diag: DiagnosticsPayload }) {
  const [open, setOpen] = useState(false);
  const n = diag.consoleErrors.length;
  const items: [string, string][] = [
    ['Browser', `${diag.device.browser} ${diag.device.browserVersion}`], ['OS', diag.device.os], ['Device', `${diag.device.type} · ${diag.device.screen}`],
    ['Viewport', diag.device.viewport], ['Timezone', diag.device.timezone], ['Screen', diag.appContext.currentView], ['Role', diag.appContext.userRole],
    ['Page open', diag.appContext.sessionDuration], ['Errors caught', String(n)], ['Online', diag.device.onLine ? 'Yes' : 'No'],
  ];
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-card/50 transition-colors">
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="min-w-0"><span className="block text-zinc-300 text-sm font-semibold leading-tight">Auto-collected diagnostics</span>
            <span className="block text-zinc-500 text-[10px] mt-0.5">{n > 0 ? `${n} error${n !== 1 ? 's' : ''} captured · tap to review` : 'Device, browser & page info ready'}</span></span>
        </span>
        <Icon name="chevronDown" className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-surface-border px-4 py-3">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mb-3">
            {items.map(([label, value]) => <div key={label}><dt className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</dt><dd className="text-xs text-zinc-300 font-medium truncate">{value || '—'}</dd></div>)}
          </dl>
          {n > 0 && (
            <div><p className="text-[9px] font-bold uppercase tracking-widest text-red-500 mb-1.5">Captured Errors ({n})</p>
              <div className="bg-zinc-900 rounded-lg p-2.5 max-h-32 overflow-y-auto">{diag.consoleErrors.map((e, i) => <p key={i} className="text-[10px] font-mono text-red-400 leading-relaxed break-all">{e}</p>)}</div></div>
          )}
          <p className="text-zinc-600 text-[10px] mt-2">All of this is sent with your ticket automatically — you don't need to describe your device.</p>
        </div>
      )}
    </div>
  );
}
