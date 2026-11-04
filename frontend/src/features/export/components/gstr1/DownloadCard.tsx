import { gstr1Download } from 'api/office/export.api';
import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { useBusy } from 'hooks/async/useBusy';
import { downloadBlob } from 'lib/browser/download';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useToast } from 'state/toast/useToast';
import { errorMessage } from 'api/errors';
import type { Range } from '../../hooks/range';

interface Props { range: Range; returnPeriod: string; disabled: boolean }

/** Downloads the portal JSON. Asks for the admin PIN first when the admin lock is on. */
export default function DownloadCard({ range, returnPeriod, disabled }: Props) {
  const { config, requirePin } = useAdminLock();
  const toast = useToast();
  const [busy, run] = useBusy();

  const download = (): Promise<void | undefined> => run(async () => {
    try {
      downloadBlob(await gstr1Download(range), `GSTR1_${range.from}_to_${range.to}.json`);
      toast('GSTR-1 JSON downloaded — upload it at gst.gov.in', 'success');
    } catch (e) { toast(errorMessage(e, 'Export failed'), 'error'); }
  });

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <p className="text-white text-xs font-semibold">Ready to download</p>
      <p className="text-zinc-500 text-[11px] mt-0.5 mb-3">Period: <span className="text-zinc-300">{range.from} → {range.to}</span> · Return period: <span className="text-zinc-300 font-mono">{returnPeriod}</span></p>
      <button type="button" className="btn btn-brand flex items-center gap-2" disabled={busy || disabled}
        onClick={() => requirePin(() => { void download(); }, 'Download GSTR-1', 'Enter admin PIN to export the GST filing')}>
        {busy ? <><Spinner />Generating…</> : <><Icon name="download" className="w-4 h-4" />Download GSTR-1 JSON</>}
      </button>
      {config.enabled && <p className="text-zinc-600 text-[10px] mt-3 flex items-center gap-1"><Icon name="lock" className="w-3 h-3" />PIN required to download</p>}
    </div>
  );
}
