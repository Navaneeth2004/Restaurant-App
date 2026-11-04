import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import type { RevenueReport } from 'types/office/export';
import { RevenueFile, useRevenueDownloads } from '../../hooks/revenue/useRevenueDownloads';

const BUTTONS: ReadonlyArray<{ file: RevenueFile; label: string; hint: string; primary?: boolean }> = [
  { file: 'visits', label: 'Visits (CSV)', hint: 'One row per visit — opens in Excel', primary: true },
  { file: 'daily', label: 'Daily summary (CSV)', hint: 'One row per day' },
  { file: 'json', label: 'Everything (JSON)', hint: 'All figures, for other software' },
];

export default function RevenueDownloads({ report, sym }: { report: RevenueReport; sym: string }) {
  const { busy, download, locked } = useRevenueDownloads(report, sym);
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <p className="text-white text-xs font-semibold">Download</p>
      <p className="text-zinc-500 text-[11px] mt-0.5 mb-3">Period: <span className="text-zinc-300">{report.period.from} → {report.period.to}</span> · Amounts are in {sym}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BUTTONS.map(b => (
          <div key={b.file}>
            <button type="button" disabled={busy} onClick={() => download(b.file)}
              className={`btn w-full flex items-center justify-center gap-2 ${b.primary ? 'btn-brand' : ''}`}>
              {busy ? <Spinner /> : <Icon name="download" className="w-4 h-4" />}{b.label}
            </button>
            <p className="text-zinc-600 text-[10px] mt-1.5 text-center">{b.hint}</p>
          </div>
        ))}
      </div>
      {locked && <p className="text-zinc-600 text-[10px] mt-3 flex items-center gap-1"><Icon name="lock" className="w-3 h-3" />PIN required to download</p>}
    </div>
  );
}
