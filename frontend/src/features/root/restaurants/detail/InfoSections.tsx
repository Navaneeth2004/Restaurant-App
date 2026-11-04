import { formatDateTime, timeAgo } from 'lib/format/local-time';
import { formatBytes } from 'lib/format/format-bytes';
import type { RestaurantDetail } from 'types/office/root';
import { KV, Section } from '../../ui/Layout';

const n = (v: number | undefined): string | number => v ?? '—';

/** Read-only technical facts. The counts are missing when the restaurant's own database could not be opened. */
export default function InfoSections({ d }: { d: RestaurantDetail }) {
  const c = d.counts;
  const s = d.settings;
  const last = d.activity.last_order_at;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Section title="Owner & live status">
        <KV rows={[['Owner phone', d.owner?.phone ?? '—'], ['Owner since', d.owner ? formatDateTime(d.owner.created_at) : '—'], ['Staff connected now', d.live.staff_sockets], ['Devices connected now', d.live.device_sockets]]} />
      </Section>
      <Section title="Storage & database">
        <KV rows={[['Database', formatBytes(d.storage.db_bytes)], ['Photos', `${d.storage.uploads_count} files · ${formatBytes(d.storage.uploads_bytes)}`], ['Schema version', d.database.schema_version ?? '—'], ['DB file', d.storage.db_file], ...(d.database.error ? [['Error', d.database.error] as const] : [])]} />
      </Section>
      <Section title="Data">
        <KV rows={[['Orders (all / closed / open)', `${n(c.orders_total)} / ${n(c.orders_closed)} / ${n(c.orders_active)}`], ['Orders today (UTC)', n(c.orders_today)], ['Staff accounts', n(c.staff_active)], ['Menu items / categories', `${n(c.menu_items)} / ${n(c.categories)}`], ['Tables', n(c.tables)], ['Deleted records', n(c.deleted_records)]]} />
      </Section>
      <Section title="Activity & settings">
        <KV rows={[['Last order', last ? `${formatDateTime(last)} (${timeAgo(last)})` : 'never'], ['First order', d.activity.first_order_at ? formatDateTime(d.activity.first_order_at) : '—'], ['Tax', `${s.tax_percent ?? '—'}%`], ['Currency', s.currency ?? '—'], ['State', s.state ?? '—'], ['GSTIN set', s.gstin_set ? 'yes' : 'no'], ['B2B invoicing', s.b2b_enabled ? 'on' : 'off'], ['Kitchen overdue', `${s.kitchen_overdue_mins ?? '—'} min`]]} />
      </Section>
    </div>
  );
}
