import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import { useMediaQuery } from 'hooks/browser/useMediaQuery';
import BillModal from 'features/billing/components/BillModal';
import TableQrModal from 'features/qr/components/TableQrModal';
import { useWaiter } from '../hooks/useWaiter';
import ParcelModal from './ParcelModal';
import WaiterDesktop from './WaiterDesktop';
import WaiterMobile from './WaiterMobile';

/** One layout is mounted at a time (not both, hidden with CSS), so nothing is duplicated in the DOM. */
export default function WaiterView() {
  const desktop = useMediaQuery('(min-width: 768px)');
  const w = useWaiter();
  return (
    <div className="flex h-full overflow-hidden">
      {w.confirm.dialog && <ConfirmDialog {...w.confirm.dialog} />}
      {w.parcelOpen && <ParcelModal onCreated={w.tables.reload} onClose={() => w.setParcelOpen(false)} />}
      {w.qrTable && <TableQrModal table={w.qrTable} onClose={() => w.setQrTable(null)} />}
      {desktop ? <WaiterDesktop w={w} /> : <WaiterMobile w={w} />}
      {w.billOrders && w.table && (
        <BillModal orders={w.billOrders} table={w.table} onClose={() => w.setBillOrders(null)} onClosed={() => { void w.onBillClosed(); }} />
      )}
    </div>
  );
}
