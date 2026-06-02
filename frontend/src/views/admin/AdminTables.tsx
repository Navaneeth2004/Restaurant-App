import React, { useState, useEffect, useCallback } from 'react';
import { getTables, createTable, updateTable, deleteTable } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../context/ToastContext';
import type { Table } from '../../types';

function statusBadge(s: Table['status']) {
  if (s === 'occupied')     return <span className="badge badge-orange text-[10px]">Occupied</span>;
  if (s === 'waiting_bill') return <span className="badge badge-green text-[10px]">Bill</span>;
  return <span className="badge badge-gray text-[10px]">Empty</span>;
}

interface ModalProps { table?: Table; onSave: (f: { label: string; seats: number }) => void; onClose: () => void; }
function TableModal({ table, onSave, onClose }: ModalProps) {
  const [label, setLabel] = useState(table?.label || '');
  const [seats, setSeats] = useState(String(table?.seats || 4));
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-700 text-white text-base mb-4">{table ? 'Edit Table' : 'Add Table'}</h3>
        <div className="space-y-3">
          <div><label className="label">Label</label><input className="input" placeholder="e.g. Table 9" value={label} onChange={e => setLabel(e.target.value)} autoFocus /></div>
          <div><label className="label">Seats</label><input className="input" type="number" min={1} max={20} value={seats} onChange={e => setSeats(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-brand flex-1" onClick={() => label && onSave({ label, seats: parseInt(seats) })}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [modal,  setModal]  = useState<{ type: 'add' | 'edit'; table?: Table } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => { try { setTables(await getTables()); } catch {} }, []);
  useEffect(() => { load(); }, []);
  useSocket('tables_updated', load);

  const handleAdd = async (f: { label: string; seats: number }) => {
    try { await createTable(f); toast('Table added', 'success'); setModal(null); load(); }
    catch (e: any) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };
  const handleEdit = async (id: string, f: { label: string; seats: number }) => {
    try { await updateTable(id, f); toast('Updated', 'success'); setModal(null); load(); }
    catch (e: any) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this table?')) return;
    try { await deleteTable(id); toast('Deleted', 'success'); load(); }
    catch (e: any) { toast(e.response?.data?.error || 'Cannot delete — active order exists', 'error'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-display font-700 text-white text-base">Tables</h3>
        <span className="badge badge-gray">{tables.length}</span>
        <button className="btn btn-brand btn-sm ml-auto" onClick={() => setModal({ type: 'add' })}>+ Add Table</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {tables.map(t => (
          <div key={t.id} className="card-sm p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-display font-700 text-sm text-white">{t.id}</div>
              <div className="flex gap-1">
                <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setModal({ type: 'edit', table: t })}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                </button>
                <button className="btn btn-icon btn-sm btn-danger" onClick={() => handleDelete(t.id)}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </div>
            </div>
            <p className="text-white text-xs font-medium truncate">{t.label}</p>
            <p className="text-zinc-600 text-[10px] mt-0.5">{t.seats} seats</p>
            <div className="mt-2">{statusBadge(t.status)}</div>
          </div>
        ))}
      </div>

      {modal?.type === 'add'  && <TableModal onSave={handleAdd} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <TableModal table={modal.table} onSave={f => handleEdit(modal.table!.id, f)} onClose={() => setModal(null)} />}
    </div>
  );
}
