/**
 * views/root/RootApp.tsx — the ROOT console (platform operator). Open  https://<site>/root
 * Root accounts are created on the server only:  node scripts/admin.js create-root <phone> <password>
 */
import React, { useCallback, useEffect, useState } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import { rootCall, timeAgo, fmtDate, bytes, daysLeft } from './rootApi';
import { Badge, Stat, statusTone, ticketTone, severityTone } from './RootUi';
import RootRestaurants from './RootRestaurants';
import RootTickets from './RootTickets';

type Tab = 'overview' | 'restaurants' | 'tickets' | 'audit';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'restaurants', label: 'Restaurants' },
  { key: 'tickets', label: 'Tickets' },   { key: 'audit', label: 'Audit log' },
];

export default function RootApp() {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);   // undefined = checking

  useEffect(() => {
    document.title = 'Root console';
    rootCall('/me').then(d => setPhone(d.phone)).catch(() => setPhone(null));
    const lost = () => setPhone(null);
    window.addEventListener('root-auth-lost', lost);
    return () => window.removeEventListener('root-auth-lost', lost);
  }, []);

  if (phone === undefined) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-700 border-t-brand-500 rounded-full animate-spin" /></div>;
  }
  if (phone === null) return <RootLogin onDone={setPhone} />;
  return <Shell phone={phone} onLogout={() => setPhone(null)} />;
}

function RootLogin({ onDone }: { onDone: (phone: string) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const d = await rootCall('/login', 'POST', { phone, password }); onDone(d.phone); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-6 space-y-3">
        <div className="text-center mb-2">
          <h1 className="font-display font-bold text-xl text-white">Root console</h1>
          <p className="text-zinc-500 text-xs mt-1">Platform administration</p>
        </div>
        <div><label className="label">Phone number</label>
          <input className="input" type="tel" autoComplete="username" value={phone} onChange={e => setPhone(e.target.value)} autoFocus /></div>
        <div><label className="label">Password</label>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
        <button className="btn btn-brand w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function Shell({ phone, onLogout }: { phone: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [openRestaurant, setOpenRestaurant] = useState<string | null>(null);
  const [ticketRestaurant, setTicketRestaurant] = useState<string>('');

  const go = (t: Tab) => setTab(t);
  const logout = async () => { try { await rootCall('/logout', 'POST'); } catch (_) {} onLogout(); };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="font-display font-bold text-white text-sm">Root console</span>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar ml-2">
            {TABS.map(t => (
              <button key={t.key} onClick={() => go(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border whitespace-nowrap transition-all ${
                  tab === t.key ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'text-zinc-400 hover:text-white border-transparent'}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-zinc-500 text-xs hidden sm:block">{phone}</span>
            <ThemeToggle />
            <button onClick={logout} className="text-xs text-zinc-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-raised">Log out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {tab === 'overview' && <Overview onOpen={id => { setOpenRestaurant(id); go('restaurants'); }} onTickets={() => { setTicketRestaurant(''); go('tickets'); }} />}
        {tab === 'restaurants' && (
          <RootRestaurants openId={openRestaurant} onOpenId={setOpenRestaurant}
            onViewTickets={id => { setTicketRestaurant(id); go('tickets'); }} />
        )}
        {tab === 'tickets' && (
          <RootTickets restaurantId={ticketRestaurant} onClearRestaurant={() => setTicketRestaurant('')}
            onOpenRestaurant={id => { setOpenRestaurant(id); go('restaurants'); }} />
        )}
        {tab === 'audit' && <Audit />}
      </main>
    </div>
  );
}

function Overview({ onOpen, onTickets }: { onOpen: (id: string) => void; onTickets: () => void }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { rootCall('/overview').then(setD).catch(e => setError(e.message)); }, []);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!d) return <p className="text-zinc-500 text-sm">Loading…</p>;
  const by = d.restaurants.by_status || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Restaurants" value={d.restaurants.total} sub={`${by.active || 0} active · ${by.suspended || 0} suspended`} />
        <Stat label="Linked devices" value={d.devices} sub={`${d.connected_sockets ?? '—'} connected now`} />
        <Stat label="Open tickets" value={d.tickets.open} sub={d.tickets.critical_open ? `${d.tickets.critical_open} critical` : 'none critical'} tone={d.tickets.critical_open ? 'red' : undefined} />
        <Stat label="Owner accounts" value={d.owners} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Latest tickets</p>
            <button onClick={onTickets} className="text-xs text-brand-400 hover:underline">View all</button>
          </div>
          {d.recent_tickets.length === 0 && <p className="text-zinc-600 text-xs">No tickets yet.</p>}
          <div className="space-y-2">
            {d.recent_tickets.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>
                <span className="text-zinc-200 truncate flex-1">{t.title}</span>
                <span className="text-zinc-500 truncate max-w-[110px]">{t.restaurant_name}</span>
                <Badge tone={ticketTone(t.status)}>{t.status.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Recently active</p>
          <div className="space-y-2">
            {d.recently_active.map((r: any) => (
              <button key={r.id} onClick={() => onOpen(r.id)} className="w-full flex items-center justify-between text-xs hover:bg-surface-raised rounded-lg px-2 py-1.5 text-left">
                <span className="text-zinc-200 truncate">{r.name}</span>
                <span className="text-zinc-500">{timeAgo(r.last_seen)}</span>
              </button>
            ))}
          </div>
        </div>

        {d.trial_ending_soon.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-3">Trials ending within 7 days</p>
            <div className="space-y-2">
              {d.trial_ending_soon.map((r: any) => (
                <button key={r.id} onClick={() => onOpen(r.id)} className="w-full flex items-center justify-between text-xs hover:bg-surface-raised rounded-lg px-2 py-1.5 text-left">
                  <span className="text-zinc-200">{r.name}</span>
                  <span className="text-amber-400">{(daysLeft(r.trial_ends_at) ?? 0) <= 0 ? 'ended' : `${daysLeft(r.trial_ends_at)}d left`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Server</p>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <span className="text-zinc-500">Node</span><span className="text-zinc-200 font-mono text-right">{d.server.node}</span>
            <span className="text-zinc-500">Uptime</span><span className="text-zinc-200 font-mono text-right">{Math.floor(d.server.uptime_s / 3600)}h {Math.floor((d.server.uptime_s % 3600) / 60)}m</span>
            <span className="text-zinc-500">Memory</span><span className="text-zinc-200 font-mono text-right">{d.server.memory_mb} MB</span>
            <span className="text-zinc-500">Mode</span><span className="text-zinc-200 font-mono text-right">{d.server.deployment}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Audit() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { rootCall('/audit').then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <p className="text-zinc-500 text-sm">Loading…</p>;
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border">
        <p className="text-sm font-bold text-white">Audit log</p>
        <p className="text-zinc-500 text-xs mt-0.5">Everything done in the root console (newest first).</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-surface-border text-left text-zinc-500">
            {['When', 'Who', 'Action', 'Target', 'Details', 'IP'].map(h => <th key={h} className="px-4 py-2.5 font-bold uppercase tracking-widest text-[10px]">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="border-b border-surface-border/50">
                <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">{fmtDate(a.at)}</td>
                <td className="px-4 py-2 text-zinc-300">{a.owner_phone || '—'}</td>
                <td className="px-4 py-2 text-white font-mono">{a.action}</td>
                <td className="px-4 py-2 text-zinc-400 font-mono">{a.target || '—'}</td>
                <td className="px-4 py-2 text-zinc-500 max-w-xs truncate" title={a.detail || ''}>{a.detail || ''}</td>
                <td className="px-4 py-2 text-zinc-500 font-mono">{a.ip || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-zinc-600 text-xs">Nothing yet.</p>}
      </div>
    </div>
  );
}

// re-exported so other root files can share the formatters
export { bytes, statusTone };