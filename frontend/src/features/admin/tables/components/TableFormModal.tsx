import { useState } from 'react';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import type { Table } from 'types/restaurant/tables';
import type { TableForm } from '../hooks/useAdminTables';

interface Props { table?: Table; defaultLabel: string; busy: boolean; onSave: (f: TableForm) => void; onClose: () => void }

export default function TableFormModal({ table, defaultLabel, busy, onSave, onClose }: Props) {
  const [label, setLabel] = useState(table?.label ?? defaultLabel);
  const [seats, setSeats] = useState(String(table?.seats ?? 4));
  const seatNum = Number.parseInt(seats, 10);
  const valid = label.trim() !== '' && Number.isInteger(seatNum) && seatNum >= 1 && seatNum <= 30;

  return (
    <Modal title={table ? 'Edit Table' : 'Add Table'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (valid) onSave({ label: label.trim(), seats: seatNum }); }}>
        <h3 className="font-bold text-white text-base mb-4">{table ? 'Edit Table' : 'Add Table'}</h3>
        <div className="space-y-3">
          <div><label className="label" htmlFor="tbl-label">Label</label>
            <input id="tbl-label" className="input" placeholder="e.g. Table 9, Corner Table, Patio 1" maxLength={40} value={label} onChange={e => setLabel(e.target.value)} autoFocus /></div>
          <div><label className="label" htmlFor="tbl-seats">Seats</label>
            <div className="flex items-center gap-2">
              {[2, 4, 6, 8].map(n => (
                <button key={n} type="button" aria-pressed={seatNum === n} onClick={() => setSeats(String(n))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${seatNum === n ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white'}`}>{n}</button>
              ))}
              <input id="tbl-seats" className="input w-20 text-center" type="number" min={1} max={30} value={seats} onChange={e => setSeats(e.target.value)} />
            </div></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-brand flex-1" disabled={!valid || busy}>{busy ? <Spinner /> : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
