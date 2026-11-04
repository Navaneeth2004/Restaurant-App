import { gstr1Preview } from 'api/office/export.api';
import { useSettings } from 'state/settings/useSettings';
import { useGstReport } from '../../hooks/useGstReport';
import GstinNotice from '../shared/GstinNotice';
import InfoTiles from '../shared/InfoTiles';
import PeriodPicker from '../shared/PeriodPicker';
import ReportStatus from '../shared/ReportStatus';
import SectionHeader from '../shared/SectionHeader';
import DownloadCard from './DownloadCard';
import Gstr1Tables from './Gstr1Tables';

export default function Gstr1Section() {
  const sym = useSettings().currency_symbol || '₹';
  const r = useGstReport(gstr1Preview);
  const d = r.data;
  return (
    <div className="space-y-5">
      <SectionHeader title="GSTR-1 Export" badge="Upload to portal" tone="blue">
        Portal-uploadable JSON. Preview the breakdown below, then download and upload at <span className="text-zinc-300">gst.gov.in → File Returns → GSTR-1 → Upload JSON.</span> Click a figure to copy it.
      </SectionHeader>
      <GstinNotice />
      <PeriodPicker range={r.range} error={r.rangeError} preset={r.preset} loading={r.loading} onRange={r.setRange} onPreset={r.choose} onRefresh={r.reload} refreshLabel="Refresh preview" />
      <ReportStatus error={r.error} onRetry={r.reload} failure="Failed to load the GSTR-1 preview" loading={r.loading} hasData={d !== null}>
        {d && (
          <>
            <InfoTiles items={[{ label: 'GSTIN', value: d.gstin }, { label: 'Legal Name', value: d.legal_name }, { label: 'Tax rate (current setting)', value: `${d.tax_rate}%` }, { label: 'Invoices', value: String(d.order_count) }]} />
            <Gstr1Tables data={d} sym={sym} />
            <DownloadCard range={r.range} returnPeriod={d.return_period} disabled={!!r.rangeError} />
          </>
        )}
      </ReportStatus>
    </div>
  );
}
