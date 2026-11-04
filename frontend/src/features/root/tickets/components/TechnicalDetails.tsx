import { useState } from 'react';
import type { TicketDetail } from 'types/office/root';
import { KV, Section } from '../../ui/Layout';

type Row = readonly [string, string];

/** Everything the ticket carried about the device and page. Missing parts (older tickets) are simply left out. */
function rowsOf(t: TicketDetail): Row[] {
  const dg = t.diagnostics ?? {};
  const dev = dg.device;
  const rows: Row[] = [['Device', t.device_name ?? '—'], ['IP address', t.ip ?? '—'], ['Browser (server saw)', t.user_agent ?? '—']];
  if (dev) rows.push(['Browser / OS', `${dev.browser} ${dev.browserVersion} · ${dev.os}`], ['Screen / viewport', `${dev.screen} · ${dev.viewport}`], ['Device type', `${dev.type}${dev.touch ? ' · touch' : ''}`], ['Timezone / language', `${dev.timezone} · ${dev.language}`], ['Online', dev.onLine ? 'yes' : 'no']);
  if (dg.appContext) rows.push(['Screen in app', dg.appContext.currentView], ['Page open for', dg.appContext.sessionDuration], ['Page URL', dg.appContext.url]);
  if (dg.network) rows.push(['Connection', `${dg.network.effectiveType} · ${dg.network.downlink} Mbps · ${dg.network.rtt} ms`]);
  if (dg.performance) rows.push(['Page load', dg.performance.pageLoad ? `${dg.performance.pageLoad} ms` : '—'], ['Memory', dg.performance.memoryUsed ?? '—']);
  rows.push(['Realtime connection', dg.socketConnected === undefined ? '—' : dg.socketConnected ? 'connected' : 'DISCONNECTED']);
  return rows;
}

export default function TechnicalDetails({ ticket }: { ticket: TicketDetail }) {
  const [raw, setRaw] = useState(false);
  const errors = ticket.diagnostics?.consoleErrors ?? [];
  return (
    <Section title="Technical details">
      <KV rows={rowsOf(ticket)} />
      {errors.length > 0 && (
        <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1.5">Captured errors ({errors.length})</p>
          <pre className="bg-zinc-900 rounded-lg p-3 text-[11px] text-red-400 whitespace-pre-wrap max-h-48 overflow-auto">{errors.join('\n')}</pre></div>
      )}
      <button type="button" className="text-[11px] text-zinc-500 hover:text-white mt-3" onClick={() => setRaw(r => !r)}>{raw ? 'Hide' : 'Show'} raw diagnostics</button>
      {raw && <pre className="bg-zinc-900 rounded-lg p-3 text-[10px] text-green-400 whitespace-pre-wrap max-h-64 overflow-auto mt-2">{JSON.stringify(ticket.diagnostics, null, 2)}</pre>}
    </Section>
  );
}
