import { revenueReport } from 'api/office/export.api';
import EmptyState from 'components/ui/feedback/EmptyState';
import { formatMoney } from 'lib/format/money';
import { useSettings } from 'state/settings/useSettings';
import { useGstReport } from '../../hooks/useGstReport';
import InfoTiles from '../shared/InfoTiles';
import PeriodPicker from '../shared/PeriodPicker';
import ReportStatus from '../shared/ReportStatus';
import SectionHeader from '../shared/SectionHeader';
import RevenueDownloads from './RevenueDownloads';
import RevenueTables from './RevenueTables';

export default function RevenueSection() {
  const sym = useSettings().currency_symbol || '₹';
  const r = useGstReport(revenueReport);
  const d = r.data;
  const m = (n: number): string => formatMoney(n, sym);
  return (
    <div className="space-y-5">
      <SectionHeader title="Revenue Report" badge="Sales record · Excel" tone="green">
        Your sales for any period — a business record, not a tax filing. Only closed (paid) visits are counted, and each visit is taxed at the rate it was closed with.
      </SectionHeader>
      <PeriodPicker title="Report Period" range={r.range} error={r.rangeError} preset={r.preset} loading={r.loading} onRange={r.setRange} onPreset={r.choose} onRefresh={r.reload} refreshLabel="Refresh" />
      <ReportStatus error={r.error} onRetry={r.reload} failure="Failed to load the revenue report" loading={r.loading} hasData={d !== null && !r.rangeError}>
        {d && (d.summary.total_orders === 0
          ? <EmptyState title="No closed visits in this period" hint="Pick a different period above." />
          : (
            <>
              <InfoTiles items={[{ label: 'Revenue (before tax)', value: m(d.summary.total_revenue_pretax) }, { label: 'Tax collected', value: m(d.summary.tax_collected) }, { label: 'Total incl. tax', value: m(d.summary.total_incl_tax) }, { label: 'Amount actually paid', value: m(d.summary.total_amount_paid) }]} />
              <InfoTiles items={[{ label: 'Visits', value: String(d.summary.total_orders) }, { label: 'Items sold', value: String(d.summary.total_items_sold) }, { label: 'Average per visit', value: m(d.summary.avg_order_value) }, { label: 'Tax setting now', value: `${d.summary.tax_percent}%` }]} />
              <RevenueTables report={d} sym={sym} />
              <RevenueDownloads report={d} sym={sym} />
            </>
          ))}
      </ReportStatus>
    </div>
  );
}
