import { useCallback, useState } from 'react';
import { gstr9 } from 'api/office/export.api';
import { FIRST_FY_YEAR } from 'config/constants';
import { useAsync } from 'hooks/async/useAsync';
import { currentFyLabel, fyOptions } from 'lib/format/local-time';
import { useSettings } from 'state/settings/useSettings';
import GstinNotice from '../shared/GstinNotice';
import InfoTiles from '../shared/InfoTiles';
import ReportStatus from '../shared/ReportStatus';
import SectionHeader from '../shared/SectionHeader';
import Gstr9Hsn from './Gstr9Hsn';
import Gstr9Monthly from './Gstr9Monthly';
import Gstr9Tables from './Gstr9Tables';
import WhoMustFile from './WhoMustFile';

export default function Gstr9Section() {
  const sym = useSettings().currency_symbol || '₹';
  const [fy, setFy] = useState(currentFyLabel);
  const load = useCallback((s: AbortSignal) => gstr9(fy, s), [fy]);
  const { data: d, loading, error, reload } = useAsync(load);

  return (
    <div className="space-y-5">
      <SectionHeader title="GSTR-9 Annual Return" badge="Annual · Manual filing" tone="purple">
        Consolidates the full financial year (April–March) for your GSTR-9 filing. Due by <span className="text-zinc-300">31 December</span> following the financial year. Click any value to copy it into the GST portal.
      </SectionHeader>
      <WhoMustFile />
      <GstinNotice />
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest mb-3">Financial Year</h4>
        <div className="flex items-center gap-3 flex-wrap">
          <select aria-label="Financial year" className="input w-44" value={fy} onChange={e => setFy(e.target.value)}>{fyOptions(FIRST_FY_YEAR).map(y => <option key={y} value={y}>FY {y}</option>)}</select>
          <button type="button" className="btn btn-sm" onClick={reload} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          {d && <span className="text-zinc-600 text-[10px]">{d.period.from} → {d.period.to}</span>}
        </div>
      </div>
      <ReportStatus error={error} onRetry={reload} failure="Failed to load the GSTR-9 summary" loading={loading} hasData={d !== null}>
        {d && (
          <>
            <InfoTiles items={[{ label: 'GSTIN', value: d.gstin }, { label: 'Legal Name', value: d.legal_name }, { label: 'Effective rate', value: `${d.tax_rate}%` }, { label: 'Dining visits', value: String(d.session_count) }]} />
            <Gstr9Tables data={d} sym={sym} />
            <Gstr9Hsn rows={d.hsn_summary} sym={sym} />
            <Gstr9Monthly data={d} sym={sym} />
            <div className="rounded-xl bg-purple-500/8 border border-purple-500/20 px-4 py-3">
              <p className="text-purple-400 text-xs font-semibold mb-1">How to file GSTR-9</p>
              <p className="text-zinc-500 text-xs leading-relaxed">Log into <span className="text-zinc-300">gst.gov.in</span> → File Returns → Annual Return → GSTR-9 → select FY {d.fy} → enter the values from the tables above. The portal fills many fields from your GSTR-1 and GSTR-3B — use this summary to verify and complete any missing amounts.</p>
            </div>
          </>
        )}
      </ReportStatus>
    </div>
  );
}
