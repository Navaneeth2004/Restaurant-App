import { formatDayLabel } from 'lib/format/local-time';
import { formatMoney } from 'lib/format/money';
import type { RevenueReport } from 'types/office/export';
import { PAYMENT_METHODS } from 'config/payment';
import BreakdownTable from './BreakdownTable';

const TOP_ITEMS = 10;
const label = (key: string): string => PAYMENT_METHODS.find(m => m.key === key)?.label ?? (key === 'unknown' ? 'Not recorded' : key);

export default function RevenueTables({ report, sym }: { report: RevenueReport; sym: string }) {
  const m = (n: number): string => formatMoney(n, sym);
  const top = report.top_items.slice(0, TOP_ITEMS);
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownTable title="By payment method" subtitle="Revenue before tax" headers={['Method', 'Visits', 'Revenue']}
          rows={report.payment_breakdown.map(p => [label(p.method), p.count, m(p.revenue)])} />
        <BreakdownTable title="Dine in and parcel" subtitle="Revenue before tax" headers={['Type', 'Visits', 'Revenue']}
          rows={report.order_type_breakdown.map(t => [t.label, t.count, m(t.revenue)])} />
      </div>
      <BreakdownTable title="Day by day" scroll headers={['Date', 'Visits', 'Items', 'Before tax', 'Tax', 'Total']}
        rows={report.daily_breakdown.map(d => [formatDayLabel(d.date), d.orders, d.items_sold, m(d.revenue), m(d.tax), m(d.total_incl_tax)])} />
      <BreakdownTable title={`Top ${top.length} items`} subtitle={report.top_items.length > top.length ? `Of ${report.top_items.length} items sold. The JSON file has them all.` : undefined}
        headers={['Item', 'Sold', 'Revenue']} rows={top.map(i => [i.name, i.qty_sold, m(i.revenue)])} />
    </>
  );
}
