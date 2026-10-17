/** Root console → Tickets: every ticket the restaurants sent, with the technical details they carried. */
import React, { useCallback, useEffect, useState } from 'react';
import { rootCall, rootUrl, timeAgo, fmtDate } from './rootApi';
import { Badge, severityTone, ticketTone, Section, KV } from './RootUi';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

export default function RootTickets({ restaurantId, onClearRestaurant, onOpenRestaurant }: {
  restaurantId: string; onClearRestaurant: () => void; onOpenRestaurant: (id: string) => void;
}) {
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (status !== 'all') p.set('status', status);
    if (severity) p.set('severity', severity);
    if (q) p.set('q', q);
    if (restaurantId) p.set('restaurant', restaurantId);
    rootCall('/tickets?' + p.toString()).then(setRows).catch(e => setError(e.message));
  }, [status, severity, q, restaurantId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Open + in progress</option><option value="all">All</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="input w-auto" value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="">Any severity</option>{['critical', 'high', 'medium', 'low'].map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="input max-w-xs" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        {restaurantId && <button onClick={onClearRestaurant} className="text-xs text-brand-400 border border-brand-500/30 rounded-full px-2.5 py-1">Restaurant filter ✕</button>}
        <button className="btn btn-sm ml-auto" onClick={load}>Refresh</button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)] gap-4 items-start">
        <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          {!rows && <p className="px-4 py-6 text-zinc-500 text-xs">Loading…</p>}
          {rows && rows.length === 0 && <p className="px-4 py-10 text-center text-zinc-600 text-xs">No tickets here.</p>}
          {rows?.map(t => (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={`w-full text-left px-4 py-3 border-b border-surface-border/60 hover:bg-surface-raised/50 ${selected === t.id ? 'bg-brand-500/5' : ''}`}>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge tone={severityTone(t.severity)}>{t.severity}</Badge><Badge tone={ticketTone(t.status)}>{t.status.replace('_', ' ')}</Badge>
                {t.has_screenshot ? <Badge>screenshot</Badge> : null}
              </div>
              <p className="text-white text-sm font-medium truncate">{t.title}</p>
              <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{t.restaurant_name} · {t.submitted_by || 'unknown'} · {timeAgo(t.created_at)}</p>
            </button>
          ))}
        </div>

        {selected ? <TicketDetail key={selected} id={selected} onChanged={load} onOpenRestaurant={onOpenRestaurant} />
          : <div className="rounded-xl border border-dashed border-surface-border p-10 text-center text-zinc-600 text-xs">Select a ticket</div>}
      </div>
    </div>
  );
}

function TicketDetail({ id, onChanged, onOpenRestaurant }: { id: number; onChanged: () => void; onOpenRestaurant: (id: string) => void }) {
  const [t, setT] = useState<any>(null);
  const [status, setStatus] = useState('open');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    rootCall('/tickets/' + id).then(d => { setT(d); setStatus(d.status); setNote(d.root_note || ''); }).catch(e => setError(e.message));
  }, [id]);

  const save = async () => {
    setMsg(''); setError('');
    try { await rootCall('/tickets/' + id, 'PATCH', { status, root_note: note }); setMsg('Saved.'); onChanged(); }
    catch (e: any) { setError(e.message); }
  };

  if (error && !t) return <p className="text-red-400 text-sm">{error}</p>;
  if (!t) return <p className="text-zinc-500 text-sm">Loading…</p>;
  const dg = t.diagnostics || {};

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>{t.category && <Badge>{t.category}</Badge>}<Badge tone={ticketTone(t.status)}>{t.status.replace('_', ' ')}</Badge>
          <span className="text-zinc-600 text-[11px]">#{t.id} · {fmtDate(t.created_at)}</span>
        </div>
        <h3 className="text-white font-bold text-base">{t.title}</h3>
        <p className="text-zinc-500 text-xs mt-1">
          {t.restaurant ? <button className="text-brand-400 hover:underline" onClick={() => onOpenRestaurant(t.restaurant.id)}>{t.restaurant.name}</button> : <span>{t.restaurant_name} (deleted)</span>}
          {' · '}{t.submitted_by || 'unknown'}{t.submitted_role ? ` (${t.submitted_role})` : ''}
        </p>
      </div>

      <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{t.description}</p>

      {t.steps?.length > 0 && (
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Steps to reproduce</p>
          <ol className="list-decimal list-inside text-zinc-300 text-xs space-y-0.5">{t.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>
      )}

      {t.has_screenshot && <a href={rootUrl(`/tickets/${t.id}/screenshot`)} target="_blank" rel="noreferrer"><img src={rootUrl(`/tickets/${t.id}/screenshot`)} alt="screenshot" className="max-h-72 rounded-lg border border-surface-border" /></a>}

      <Section title="Technical details">
        <KV rows={[
          ['Device', t.device_name || '—'], ['IP address', t.ip || '—'], ['Browser (server saw)', t.user_agent || '—'],
          ...(dg.device ? [['Browser / OS', `${dg.device.browser} ${dg.device.browserVersion} · ${dg.device.os}`], ['Screen / viewport', `${dg.device.screen} · ${dg.device.viewport}`],
            ['Device type', `${dg.device.type}${dg.device.touch ? ' · touch' : ''}`], ['Timezone / language', `${dg.device.timezone} · ${dg.device.language}`],
            ['Online', dg.device.onLine ? 'yes' : 'no']] as [string, string][] : []),
          ...(dg.appContext ? [['Screen in app', dg.appContext.currentView], ['Session length', dg.appContext.sessionDuration], ['Page URL', dg.appContext.url]] as [string, string][] : []),
          ...(dg.network ? [['Connection', `${dg.network.effectiveType} · ${dg.network.downlink} Mbps · ${dg.network.rtt} ms`]] as [string, string][] : []),
          ...(dg.performance ? [['Page load', dg.performance.pageLoad ? `${dg.performance.pageLoad} ms` : '—'], ['Memory', dg.performance.memoryUsed || '—']] as [string, string][] : []),
          ['Realtime connection', dg.socketConnected === undefined ? '—' : dg.socketConnected ? 'connected' : 'DISCONNECTED'],
        ]} />
        {dg.consoleErrors?.length > 0 && (
          <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1.5">Captured errors ({dg.consoleErrors.length})</p>
            <pre className="bg-zinc-900 rounded-lg p-3 text-[11px] text-red-400 whitespace-pre-wrap max-h-48 overflow-auto">{dg.consoleErrors.join('\n')}</pre></div>
        )}
        <button className="text-[11px] text-zinc-500 hover:text-white mt-3" onClick={() => setRaw(r => !r)}>{raw ? 'Hide' : 'Show'} raw diagnostics</button>
        {raw && <pre className="bg-zinc-900 rounded-lg p-3 text-[10px] text-green-400 whitespace-pre-wrap max-h-64 overflow-auto mt-2">{JSON.stringify(t.diagnostics, null, 2)}</pre>}
      </Section>

      <div className="border-t border-surface-border pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="label mb-0">Status</label>
          <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
          {t.resolved_at && <span className="text-zinc-600 text-[11px]">resolved {timeAgo(t.resolved_at)}</span>}
        </div>
        <div><label className="label">Your note (private)</label><textarea className="input resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} /></div>
        {msg && <p className="text-emerald-400 text-xs">{msg}</p>}{error && <p className="text-red-400 text-xs">{error}</p>}
        <button className="btn btn-brand btn-sm" onClick={save}>Save</button>
      </div>
    </div>
  );
}