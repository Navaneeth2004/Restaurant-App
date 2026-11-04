import { useState } from 'react';
import { errorMessage } from 'api/errors';
import QrCode from 'components/qr/QrCode';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import Icon from 'components/ui/base/Icon';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import { useTimeouts } from 'hooks/time/useTimeouts';
import { downloadDataUrl } from 'lib/browser/download';
import { qrDataUrl } from 'lib/browser/qr';
import { useToast } from 'state/toast/useToast';
import { useTableQr } from '../hooks/useTableQr';

interface Props { table: { id: string; label: string; seats: number }; onClose: () => void }

export default function TableQrModal({ table, onClose }: Props) {
  const { url, error, loading, retry } = useTableQr(table.id);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const later = useTimeouts();

  const copy = async (): Promise<void> => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); later(() => setCopied(false), 2000); }
    catch { toast('Could not copy. Select the link and copy it manually.', 'error'); }
  };
  const save = async (): Promise<void> => {
    if (!url) return;
    try { downloadDataUrl(await qrDataUrl(url, 512), `qr-${table.label.replace(/\s+/g, '-').toLowerCase()}.png`); }
    catch (e) { toast(errorMessage(e, 'Could not save the QR image'), 'error'); }
  };

  return (
    <Modal title={`QR code — ${table.label}`} onClose={onClose}>
      <div className="no-print flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">QR Code — {table.label}</h3>
          <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">Customers scan this to browse the menu and order from their phone</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised flex-shrink-0"><Icon name="x" strokeWidth={2.5} /></button>
      </div>
      {loading && <div className="flex justify-center py-10"><Spinner className="w-8 h-8 border-zinc-700 border-t-brand-500" /></div>}
      {!loading && error ? <ErrorNotice error={error} onRetry={retry} fallback="Could not create the QR code" /> : null}
      {url && (
        <>
          <div className="qr-print-area flex flex-col items-center mb-4">
            <div className="bg-white p-3 rounded-2xl border border-zinc-100 mb-3"><QrCode value={url} size={200} /></div>
            <p className="text-white text-sm font-semibold">{table.label}</p>
            <p className="text-zinc-500 text-xs">{table.seats} seats · Scan to order &amp; pay</p>
          </div>
          <div className="no-print rounded-lg bg-surface-raised border border-surface-border p-3 mb-3">
            <p className="label">Customer link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-zinc-300 text-[11px] break-all font-mono select-all">{url}</code>
              <button type="button" onClick={() => { void copy(); }} className="btn btn-sm flex-shrink-0">{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          <div className="no-print grid grid-cols-3 gap-2">
            <button type="button" className="btn btn-brand btn-sm" onClick={() => window.print()}><Icon name="printer" className="w-3.5 h-3.5" />Print</button>
            <button type="button" className="btn btn-sm" onClick={() => { void save(); }}><Icon name="download" className="w-3.5 h-3.5" />Save</button>
            <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}
