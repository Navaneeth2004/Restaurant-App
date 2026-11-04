import { useCallback } from 'react';
import { errorMessage } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import { downloadBlob } from 'lib/browser/download';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useToast } from 'state/toast/useToast';
import type { RevenueReport } from 'types/office/export';
import { dailyCsv, revenueJson, visitsCsv } from './revenue-csv';

export type RevenueFile = 'visits' | 'daily' | 'json';

const FILES: Record<RevenueFile, { name: string; type: string; ext: string; build: (r: RevenueReport, sym: string) => string }> = {
  visits: { name: 'Revenue_visits', type: 'text/csv;charset=utf-8', ext: 'csv', build: visitsCsv },
  daily: { name: 'Revenue_daily', type: 'text/csv;charset=utf-8', ext: 'csv', build: dailyCsv },
  json: { name: 'Revenue_full', type: 'application/json', ext: 'json', build: r => revenueJson(r) },
};

/**
 * Saves a file built from the figures on screen (so the file always matches what the owner sees).
 * Asks for the admin PIN first when the admin lock is on.
 */
export function useRevenueDownloads(report: RevenueReport, sym: string) {
  const { config, requirePin } = useAdminLock();
  const toast = useToast();
  const [busy, run] = useBusy();

  const save = useCallback((file: RevenueFile): Promise<void | undefined> => run(async () => {
    const f = FILES[file];
    try {
      const { from, to } = report.period;
      downloadBlob(new Blob([f.build(report, sym)], { type: f.type }), `${f.name}_${from}_to_${to}.${f.ext}`);
      toast('File downloaded', 'success');
    } catch (e) { toast(errorMessage(e, 'Could not create the file'), 'error'); }
  }), [report, sym, run, toast]);

  const download = useCallback((file: RevenueFile) => {
    requirePin(() => { void save(file); }, 'Download revenue report', 'Enter admin PIN to export sales data');
  }, [requirePin, save]);

  return { busy, download, locked: config.enabled };
}
