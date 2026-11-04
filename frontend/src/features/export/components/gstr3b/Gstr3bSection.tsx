import { gstr3b } from 'api/office/export.api';
import { useSettings } from 'state/settings/useSettings';
import { outwardRows, taxPaidRows } from '../../hooks/gst-rows';
import { useGstReport } from '../../hooks/useGstReport';
import AmountTable from '../shared/AmountTable';
import GstinNotice from '../shared/GstinNotice';
import InfoTiles from '../shared/InfoTiles';
import PeriodPicker from '../shared/PeriodPicker';
import ReportStatus from '../shared/ReportStatus';
import SectionHeader from '../shared/SectionHeader';

export default function Gstr3bSection() {
  const sym = useSettings().currency_symbol || '₹';
  const r = useGstReport(gstr3b);
  const d = r.data;
  return (
    <div className="space-y-5">
      <SectionHeader title="GSTR-3B Summary" badge="Manual filing guide" tone="green">Shows the exact values to enter on the GST portal under GSTR-3B. Click any value to copy it.</SectionHeader>
      <GstinNotice />
      <PeriodPicker range={r.range} error={r.rangeError} preset={r.preset} loading={r.loading} onRange={r.setRange} onPreset={r.choose} onRefresh={r.reload} refreshLabel="Refresh" />
      <ReportStatus error={r.error} onRetry={r.reload} failure="Failed to load the GSTR-3B summary" loading={r.loading} hasData={d !== null}>
        {d && (
          <>
            <InfoTiles items={[{ label: 'GSTIN', value: d.gstin }, { label: 'Legal Name', value: d.legal_name }, { label: 'Effective rate', value: `${d.tax_rate}%` }, { label: 'Orders', value: String(d.order_count) }]} />
            <AmountTable title="Table 3.1 — Outward Taxable Supplies" subtitle="Enter under GSTR-3B → 3.1(a). Click a value to copy." sym={sym} rows={outwardRows(d)} />
            <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="bg-surface-raised px-4 py-3 border-b border-surface-border"><p className="text-zinc-300 text-xs font-semibold">Table 4 — Eligible ITC</p></div>
              <p className="px-4 py-3 text-zinc-500 text-xs leading-relaxed">{d.itc_claimed.note}</p>
            </div>
            <AmountTable title="Table 6.1 — Tax Paid" subtitle='Same as 3.1 amounts — enter under "Tax paid through cash/ITC" on the portal.' sym={sym} rows={taxPaidRows(d.tax_paid)} />
            <div className="rounded-xl bg-brand-500/8 border border-brand-500/20 px-4 py-3">
              <p className="text-brand-400 text-xs font-semibold mb-1">How to use this</p>
              <p className="text-zinc-500 text-xs leading-relaxed">Log into <span className="text-zinc-300">gst.gov.in</span> → File Returns → GSTR-3B → enter the values above. For GSTR-1, switch to the GSTR-1 tab and download the JSON to upload directly.</p>
            </div>
          </>
        )}
      </ReportStatus>
    </div>
  );
}
