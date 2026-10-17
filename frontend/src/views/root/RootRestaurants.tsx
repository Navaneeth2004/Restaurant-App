/**
 * Root console → Restaurants: list, create, edit, suspend/activate, technical details, devices, delete.
 * Plans and limit fields come from the server (GET /api/root/config), so adding a plan or a limit
 * in backend/core/entitlements.js shows up here automatically.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { rootCall, timeAgo, fmtDate, bytes, daysLeft } from './rootApi';
import { Modal, Badge, statusTone, Field, KV, Section } from './RootUi';

interface Config { plans: string[]; limit_keys: { key: string; label: string }[]; plan_defaults: Record<string, any>; enforce_trial: boolean }

export default function RootRestaurants({ openId, onOpenId, onViewTickets }: {
  openId: string | null; onOpenId: (id: string | null) => void; onViewTickets: (restaurantId: string) => void;
}) {
  const [list, setList] = useState<any[] | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => { rootCall('/restaurants').then(setList).catch(e => setError(e.message)); }, []);
  useEffect(() => { load(); rootCall('/config').then(setConfig).catch(() => {}); }, [load]);

  const rows = useMemo(() => (list || []).filter(r =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!q || `${r.name} ${r.id} ${r.owner_phone}`.toLowerCase().includes(q.toLowerCase()))), [list, q, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input max-w-xs" placeholder="Search name, id or phone…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
        <span className="text-zinc-500 text-xs">{rows.length} of {list?.length ?? 0}</span>
        <button className="btn btn-brand btn-sm ml-auto" onClick={() => setShowCreate(true)}>+ New restaurant</button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!list && !error && <p className="text-zinc-500 text-sm">Loading…</p>}

      {list && (
        <div className="rounded-xl border border-surface-border bg-surface-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-surface-border text-left text-zinc-500">
              {['Restaurant', 'Owner', 'Status', 'Plan', 'Trial', 'Devices', 'Last seen', 'Tickets', 'DB'].map(h =>
                <th key={h} className="px-4 py-2.5 font-bold uppercase tracking-widest text-[10px] whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const dl = daysLeft(r.trial_ends_at);
                return (
                  <tr key={r.id} onClick={() => onOpenId(r.id)} className="border-b border-surface-border/50 hover:bg-surface-raised/50 cursor-pointer">
                    <td className="px-4 py-3"><p className="text-white font-semibold text-sm">{r.name}</p><p className="text-zinc-600 font-mono text-[10px]">{r.id}</p></td>
                    <td className="px-4 py-3 text-zinc-300 font-mono">{r.owner_phone}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                    <td className="px-4 py-3 text-zinc-300">{r.plan}</td>
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{r.plan === 'trial' && r.trial_ends_at ? (dl! <= 0 ? <span className="text-red-400">ended</span> : `${dl}d left`) : '—'}</td>
                    <td className="px-4 py-3 text-zinc-300 font-mono">{r.devices}</td>
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{timeAgo(r.last_seen_at)}</td>
                    <td className="px-4 py-3">{r.open_tickets ? <Badge tone="amber">{r.open_tickets} open</Badge> : <span className="text-zinc-600">—</span>}</td>
                    <td className="px-4 py-3 text-zinc-400 font-mono whitespace-nowrap">{bytes(r.db_bytes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-4 py-8 text-center text-zinc-600 text-xs">No restaurants match.</p>}
        </div>
      )}

      {showCreate && config && <CreateModal config={config} onClose={() => setShowCreate(false)} onCreated={() => { load(); }} />}
      {openId && config && (
        <Detail id={openId} config={config} onClose={() => { onOpenId(null); load(); }} onChanged={load} onViewTickets={onViewTickets} />
      )}
    </div>
  );
}

// ── create ────────────────────────────────────────────────────────────────
function CreateModal({ config, onClose, onCreated }: { config: Config; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ restaurant_name: '', owner_phone: '', owner_password: '', admin_name: '', admin_pin: '', plan: 'trial', trial_days: '30', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { setResult(await rootCall('/restaurants', 'POST', f)); onCreated(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (result) {
    return (
      <Modal title="Restaurant created" onClose={onClose}>
        <p className="text-zinc-400 text-xs mb-3">Save these now — the generated values are shown only once.</p>
        <KV rows={[['Restaurant', result.name], ['Owner phone', result.owner_phone],
          ['Owner password', result.temp_owner_password || '(the one you typed / existing account)'],
          ['Admin PIN', result.admin_pin || '(the one you typed)']]} />
        <button className="btn btn-brand w-full mt-4" onClick={onClose}>Done</button>
      </Modal>
    );
  }
  return (
    <Modal title="New restaurant" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Restaurant name"><input className="input" value={f.restaurant_name} onChange={e => set('restaurant_name', e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner phone"><input className="input" type="tel" value={f.owner_phone} onChange={e => set('owner_phone', e.target.value)} /></Field>
          <Field label="Owner password" hint="Empty = generate one (new owners only)"><input className="input" value={f.owner_password} onChange={e => set('owner_password', e.target.value)} /></Field>
          <Field label="Admin's name"><input className="input" value={f.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Admin" /></Field>
          <Field label="Admin PIN" hint="Empty = generate"><input className="input font-mono" inputMode="numeric" maxLength={6} value={f.admin_pin} onChange={e => set('admin_pin', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Plan"><select className="input" value={f.plan} onChange={e => set('plan', e.target.value)}>{config.plans.map(p => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Trial days" hint="Only used for the trial plan"><input className="input" type="number" min={0} value={f.trial_days} onChange={e => set('trial_days', e.target.value)} /></Field>
        </div>
        <Field label="Private notes"><textarea className="input resize-none" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        {error && <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
        <button className="btn btn-brand w-full" disabled={busy}>{busy ? 'Creating…' : 'Create restaurant'}</button>
      </form>
    </Modal>
  );
}

// ── detail ────────────────────────────────────────────────────────────────
function Detail({ id, config, onClose, onChanged, onViewTickets }: {
  id: string; config: Config; onClose: () => void; onChanged: () => void; onViewTickets: (id: string) => void;
}) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [dialog, setDialog] = useState<null | 'suspend' | 'delete' | 'password'>(null);
  const [shown, setShown] = useState<string | null>(null);

  const apply = (data: any) => {
    setD(data);
    setForm({
      name: data.name, plan: data.plan, notes: data.notes || '',
      trial_ends_at: data.trial_ends_at ? data.trial_ends_at.slice(0, 10) : '',
      limits: Object.fromEntries(config.limit_keys.map(k => [k.key, data.limits_override[k.key] ?? ''])),
    });
  };
  const load = useCallback(() => { rootCall('/restaurants/' + id).then(apply).catch(e => setError(e.message)); }, [id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true); setError(''); setMsg('');
    try { await fn(); if (ok) setMsg(ok); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const save = () => run(async () => {
    const limits: Record<string, any> = {};
    for (const [k, v] of Object.entries(form.limits)) limits[k] = v === '' ? null : Number(v);
    apply(await rootCall('/restaurants/' + id, 'PATCH', {
      name: form.name, plan: form.plan, notes: form.notes, limits,
      trial_ends_at: form.trial_ends_at ? new Date(form.trial_ends_at + 'T23:59:59').toISOString() : null,
    }));
  }, 'Saved.');

  if (!d || !form) {
    return <Modal title="Restaurant" onClose={onClose} wide>{error ? <p className="text-red-400 text-sm">{error}</p> : <p className="text-zinc-500 text-sm">Loading…</p>}</Modal>;
  }
  const c = d.counts || {};

  return (
    <Modal title={d.name} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={statusTone(d.status)}>{d.status}</Badge><Badge tone="indigo">{d.plan}</Badge>
          <button className="font-mono text-[11px] text-zinc-500 hover:text-white" onClick={() => navigator.clipboard.writeText(d.id)} title="Copy id">{d.id}</button>
          <span className="text-zinc-600 text-[11px]">created {fmtDate(d.created_at)}</span>
        </div>
        {d.status === 'suspended' && (
          <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
            Suspended {d.suspended_at ? timeAgo(d.suspended_at) : ''}{d.suspended_reason ? ` — ${d.suspended_reason}` : ''}
          </div>
        )}
        {msg && <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">{msg}</div>}
        {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">{error}</div>}

        <Section title="Account">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name (your label)"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Plan"><select className="input" value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}>{config.plans.map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Trial ends" hint={config.enforce_trial ? 'Trial limits are being enforced.' : 'Not enforced yet (ENFORCE_TRIAL=false).'}>
              <input className="input" type="date" value={form.trial_ends_at} onChange={e => setForm({ ...form, trial_ends_at: e.target.value })} /></Field>
            <Field label="Private notes"><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-4 mb-2">Limits (blank = use the plan default / unlimited)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {config.limit_keys.map(k => (
              <Field key={k.key} label={k.label} hint={`Plan default: ${config.plan_defaults[form.plan]?.[k.key] ?? 'unlimited'} · in effect: ${d.limits_effective[k.key] ?? 'unlimited'}`}>
                <input className="input font-mono" type="number" min={0} value={form.limits[k.key]} onChange={e => setForm({ ...form, limits: { ...form.limits, [k.key]: e.target.value } })} />
              </Field>
            ))}
          </div>
          <button className="btn btn-brand btn-sm mt-4" onClick={save} disabled={busy}>Save changes</button>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Owner & live status">
            <KV rows={[['Owner phone', d.owner.phone], ['Owner since', fmtDate(d.owner.created_at)],
              ['Staff connected now', d.live.staff_sockets], ['Devices connected now', d.live.device_sockets]]} />
          </Section>
          <Section title="Storage & database">
            <KV rows={[['Database', bytes(d.storage.db_bytes)], ['Photos', `${d.storage.uploads_count} files · ${bytes(d.storage.uploads_bytes)}`],
              ['Schema version', d.database.schema_version ?? '—'], ['DB file', d.storage.db_file], ...(d.database.error ? [['Error', d.database.error] as [string, string]] : [])]} />
          </Section>
          <Section title="Data">
            <KV rows={[['Orders (all / closed / open)', `${c.orders_total} / ${c.orders_closed} / ${c.orders_active}`], ['Orders today (UTC)', c.orders_today],
              ['Staff accounts', c.staff_active], ['Menu items / categories', `${c.menu_items} / ${c.categories}`], ['Tables', c.tables], ['Deleted records', c.deleted_records]]} />
          </Section>
          <Section title="Activity & settings">
            <KV rows={[['Last order', d.activity.last_order_at ? `${fmtDate(d.activity.last_order_at)} (${timeAgo(d.activity.last_order_at)})` : 'never'],
              ['First order', fmtDate(d.activity.first_order_at)], ['Tax', `${d.settings.tax_percent ?? '—'}%`], ['Currency', d.settings.currency ?? '—'],
              ['State', d.settings.state ?? '—'], ['GSTIN set', d.settings.gstin_set ? 'yes' : 'no'], ['B2B invoicing', d.settings.b2b_enabled ? 'on' : 'off'],
              ['Kitchen overdue', `${d.settings.kitchen_overdue_mins ?? '—'} min`]]} />
          </Section>
        </div>

        <Section title={`Linked devices (${d.devices.length})`}>
          {d.devices.length === 0 ? <p className="text-zinc-600 text-xs">No devices linked.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="text-left text-zinc-500">{['Device', 'Lock', 'Linked by', 'Last seen', 'IP', 'Browser'].map(h => <th key={h} className="pb-2 pr-4 font-bold uppercase tracking-widest text-[10px]">{h}</th>)}</tr></thead>
              <tbody>{d.devices.map((x: any) => (
                <tr key={x.id} className="border-t border-surface-border/50">
                  <td className="py-2 pr-4 text-white">{x.name}</td><td className="py-2 pr-4 text-zinc-400">{x.role_lock || '—'}</td>
                  <td className="py-2 pr-4 text-zinc-400">{x.created_via || '—'}</td><td className="py-2 pr-4 text-zinc-400 whitespace-nowrap">{timeAgo(x.last_seen_at)}</td>
                  <td className="py-2 pr-4 text-zinc-400 font-mono">{x.last_ip || '—'}</td>
                  <td className="py-2 text-zinc-500 max-w-[220px] truncate" title={x.user_agent || ''}>{x.user_agent || '—'}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Section>

        <Section title="Tickets">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-300">{d.tickets.open} open · {d.tickets.total} total</span>
            <button className="text-brand-400 hover:underline" onClick={() => { onClose(); onViewTickets(d.id); }}>View tickets</button>
          </div>
        </Section>

        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            {d.status === 'active'
              ? <button className="btn btn-sm btn-danger" onClick={() => setDialog('suspend')}>Suspend</button>
              : <button className="btn btn-sm btn-success" disabled={busy} onClick={() => run(async () => { await rootCall(`/restaurants/${id}/activate`, 'POST'); load(); }, 'Activated.')}>Activate</button>}
            <button className="btn btn-sm" disabled={busy} onClick={() => { if (window.confirm('Disconnect every device of this restaurant? They must link again.')) run(async () => { const r = await rootCall(`/restaurants/${id}/revoke-devices`, 'POST'); load(); setMsg(`${r.revoked} device(s) revoked.`); }); }}>Revoke all devices</button>
            <button className="btn btn-sm" onClick={() => setDialog('password')}>Reset owner password</button>
            <button className="btn btn-sm btn-danger ml-auto" onClick={() => setDialog('delete')}>Delete restaurant…</button>
          </div>
        </Section>
      </div>

      {dialog === 'suspend' && <Suspend onCancel={() => setDialog(null)} onDone={reason => { setDialog(null); run(async () => { await rootCall(`/restaurants/${id}/suspend`, 'POST', { reason }); load(); }, 'Suspended.'); }} />}
      {dialog === 'password' && <ResetPassword onCancel={() => setDialog(null)} onDone={async pw => {
        setDialog(null);
        run(async () => { const r = await rootCall(`/restaurants/${id}/owner-password`, 'POST', pw ? { password: pw } : {}); if (r.temp_password) setShown(r.temp_password); }, 'Owner password changed.');
      }} />}
      {dialog === 'delete' && <DeleteDialog name={d.name} onCancel={() => setDialog(null)} onDone={async (confirm_name, password) => {
        try { await rootCall('/restaurants/' + id, 'DELETE', { confirm_name, password }); onChanged(); onClose(); }
        catch (e: any) { setDialog(null); setError(e.message); }
      }} />}
      {shown && <Modal title="New owner password" onClose={() => setShown(null)}><p className="text-zinc-400 text-xs mb-3">Shown once. Give it to the owner.</p><p className="font-mono text-white text-lg text-center select-all">{shown}</p><button className="btn btn-brand w-full mt-4" onClick={() => setShown(null)}>Done</button></Modal>}
    </Modal>
  );
}

function Suspend({ onCancel, onDone }: { onCancel: () => void; onDone: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Suspend restaurant" onClose={onCancel}>
      <p className="text-zinc-400 text-xs mb-3">All devices are disconnected immediately and cannot get back in until you activate it again.</p>
      <Field label="Reason (shown to them)"><input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Payment pending" autoFocus /></Field>
      <div className="flex gap-2 mt-4"><button className="btn flex-1" onClick={onCancel}>Cancel</button><button className="btn btn-danger flex-1" onClick={() => onDone(reason)}>Suspend</button></div>
    </Modal>
  );
}
function ResetPassword({ onCancel, onDone }: { onCancel: () => void; onDone: (pw: string) => void }) {
  const [pw, setPw] = useState('');
  return (
    <Modal title="Reset owner password" onClose={onCancel}>
      <Field label="New password" hint="Leave empty to generate one (it will be shown once)."><input className="input" value={pw} onChange={e => setPw(e.target.value)} autoFocus /></Field>
      <div className="flex gap-2 mt-4"><button className="btn flex-1" onClick={onCancel}>Cancel</button><button className="btn btn-brand flex-1" onClick={() => onDone(pw)}>Reset</button></div>
    </Modal>
  );
}
function DeleteDialog({ name, onCancel, onDone }: { name: string; onCancel: () => void; onDone: (confirmName: string, password: string) => void }) {
  const [n, setN] = useState(''); const [pw, setPw] = useState('');
  return (
    <Modal title="Delete restaurant permanently" onClose={onCancel}>
      <p className="text-red-400 text-xs mb-3">This deletes all orders, menu, staff and photos of “{name}”. It cannot be undone. Take a backup first if unsure.</p>
      <div className="space-y-3">
        <Field label={`Type the name to confirm: ${name}`}><input className="input" value={n} onChange={e => setN(e.target.value)} autoFocus /></Field>
        <Field label="Your root password"><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
      </div>
      <div className="flex gap-2 mt-4"><button className="btn flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger flex-1" disabled={n !== name || !pw} onClick={() => onDone(n, pw)}>Delete forever</button></div>
    </Modal>
  );
}