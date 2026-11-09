import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import Icon from 'components/ui/base/Icon';
import { isParcelTable } from 'lib/input/ids';
import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';
import type { WaiterState } from '../../hooks/useWaiter';
import TableButton from './TableButton';

export default function TableList({ w, mobile }: { w: WaiterState; mobile: boolean }) {
  const { tables, loading, error, reload } = w.tables;
  const { isOn } = useFeatures();
  const dineIn = tables.filter(t => !isParcelTable(t));
  const parcels = tables.filter(isParcelTable);
  const grid = mobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-2.5';
  const card = (t: (typeof tables)[number]) => (
    <TableButton key={t.id} table={t} mobile={mobile} nowMs={w.nowMs} selected={w.table?.id === t.id}
      onSelect={w.select} onRemoveParcel={w.askRemoveParcel} onShowQr={w.setQrTable} />
  );

  return (
    <div className="flex flex-col gap-3">
      {error && tables.length === 0 ? <ErrorNotice error={error} onRetry={reload} fallback="Could not load tables" /> : null}
      {!loading && !error && dineIn.length === 0 && <EmptyState title="No tables yet" hint="An admin can add tables under Admin → Tables." />}
      <div className={grid}>{dineIn.map(card)}</div>
      {parcels.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400/70 flex-shrink-0">Parcel / Takeaway</p>
            <div className="h-px flex-1 bg-indigo-500/15" />
          </div>
          <div className={grid}>{parcels.map(card)}</div>
        </div>
      )}
      {isOn(FEATURE.parcel) && (
        <button type="button" onClick={() => w.setParcelOpen(true)}
          className={`w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-500/25 hover:border-indigo-500/50 text-indigo-400/60 hover:text-indigo-400 font-semibold transition-all ${mobile ? 'py-3 text-xs' : 'py-2 text-[11px]'}`}>
          <Icon name="plus" className={mobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />New Parcel
        </button>
      )}
    </div>
  );
}
