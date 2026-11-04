import { useCallback, useState } from 'react';
import { exportMenu, importMenuJson, importMenuZip } from 'api/office/export.api';
import { errorMessage } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import { downloadBlob } from 'lib/browser/download';
import { useToast } from 'state/toast/useToast';
import type { MenuImportResult } from 'types/office/export';

export type ImportOutcome = { kind: 'ok'; text: string } | { kind: 'error'; text: string } | null;

export function summarizeImport(r: MenuImportResult): string {
  const images = r.images_imported ? `, ${r.images_imported} images` : '';
  return `Done — ${r.categories_added} categories added, ${r.items_added} items added${images}, ${r.items_skipped} skipped`;
}

export function useMenuTransfer() {
  const [exporting, runExport] = useBusy();
  const [importing, runImport] = useBusy();
  const [outcome, setOutcome] = useState<ImportOutcome>(null);
  const toast = useToast();

  const doExport = useCallback(() => runExport(async () => {
    try {
      downloadBlob(await exportMenu(), `menu_export_${new Date().toISOString().slice(0, 10)}.zip`);
      toast('Menu exported', 'success');
    } catch (e) { toast(errorMessage(e, 'Export failed'), 'error'); }
  }), [runExport, toast]);

  const doImport = useCallback((file: File) => runImport(async () => {
    setOutcome(null);
    try {
      let result: MenuImportResult;
      if (/\.zip$/i.test(file.name) || file.type.includes('zip')) result = await importMenuZip(file);
      else if (/\.json$/i.test(file.name) || file.type === 'application/json') {
        let data: unknown;
        try { data = JSON.parse(await file.text()); } catch { throw new Error('That file is not valid JSON.'); }
        result = await importMenuJson(data);
      } else throw new Error('Please choose a .zip or .json file');
      setOutcome({ kind: 'ok', text: summarizeImport(result) });
      toast('Menu imported successfully', 'success');
    } catch (e) {
      const text = e instanceof Error && !('status' in e) ? e.message : errorMessage(e, 'Import failed — check the file format');
      setOutcome({ kind: 'error', text });
      toast(text, 'error');
    }
  }), [runImport, toast]);

  return { exporting, importing, outcome, doExport, doImport };
}
