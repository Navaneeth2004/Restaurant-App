import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getTables, createTable, updateTable, deleteTable, reorderTables } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../context/ToastContext';
import type { Table } from '../../types';

const STATUS_STYLE: Record<string, string> = {
  occupied:     'text-brand-400 bg-brand-500/10 border-brand-500/20',
  waiting_bill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  empty:        'text-zinc-500 bg-zinc-800/50 border-zinc-700/50',
};
const STATUS_LABEL: Record<string, string> = {
  occupied: 'Occupied', waiting_bill: 'Bill', empty: 'Empty',
};

interface ModalProps { table?: Table; onSave: (f:{label:string;seats:number}) => void; onClose: () => void; }
function TableModal({ table, onSave, onClose }: ModalProps) {
  const [label, setLabel] = useState(table?.label || '');
  const [seats, setSeats] = useState(String(table?.seats || 4));
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white text-base mb-4">{table ? 'Edit Table' : 'Add Table'}</h3>
        <div className="space-y-3">
          <div><label className="label">Label</label>
            <input className="input" placeholder="e.g. Table 9, Corner Table, Patio 1" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>
          <div><label className="label">Seats</label>
            <div className="flex items-center gap-2">
              {[2,4,6,8].map(n => (
                <button key={n} onClick={() => setSeats(String(n))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${seats===String(n) ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white'}`}>
                  {n}
                </button>
              ))}
              <input className="input w-20 text-center" type="number" min={1} max={30} value={seats} onChange={e => setSeats(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-brand flex-1" onClick={() => label && onSave({ label, seats: parseInt(seats)||4 })} disabled={!label}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTables() {
  const [tables,    setTables]    = useState<Table[]>([]);
  const [modal,     setModal]     = useState<{type:'add'|'edit'; table?: Table} | null>(null);
  const [dragging,  setDragging]  = useState<string | null>(null);
  const [dragOver,  setDragOver]  = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setTables(await getTables()); } catch {}
  }, []);
  useEffect(() => { load(); }, []);
  useSocket('tables_updated', load);

  const handleAdd  = async (f: {label:string;seats:number}) => {
    try { await createTable(f); toast('Table added','success'); setModal(null); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Failed','error'); }
  };
  const handleEdit = async (id: string, f: {label:string;seats:number}) => {
    try { await updateTable(id, f); toast('Updated','success'); setModal(null); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Failed','error'); }
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this table?')) return;
    try { await deleteTable(id); toast('Deleted','success'); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Active order — cannot delete','error'); }
  };

  // Drag-to-reorder handlers
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnd   = async () => {
    if (!dragging || !dragOver || dragging === dragOver) { setDragging(null); setDragOver(null); return; }
    const from = tables.findIndex(t => t.id === dragging);
    const to   = tables.findIndex(t => t.id === dragOver);
    const reordered = [...tables];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const withOrder = reordered.map((t, i) => ({ ...t, sort_order: i }));
    setTables(withOrder);
    setDragging(null); setDragOver(null);
    try {
      await reorderTables(withOrder.map(t => ({ id: t.id, sort_order: (t as any).sort_order })));
    } catch { toast('Failed to save order','error'); load(); }
  };

  const counts = {
    empty:        tables.filter(t => t.status === 'empty').length,
    occupied:     tables.filter(t => t.status === 'occupied').length,
    waiting_bill: tables.filter(t => t.status === 'waiting_bill').length,
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h3 className="font-bold text-white text-base">Tables</h3>
        <span className="text-xs font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{tables.length} total</span>
        {Object.entries(counts).map(([k, v]) => v > 0 && (
          <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[k]}`}>{v} {STATUS_LABEL[k]}</span>
        ))}
        <p className="text-zinc-600 text-xs ml-1 hidden sm:block">Drag cards to reorder</p>
        <button className="btn btn-brand btn-sm ml-auto" onClick={() => setModal({type:'add'})}>+ Add Table</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {tables.map(t => (
          <div
            key={t.id}
            draggable
            onDragStart={() => handleDragStart(t.id)}
            onDragOver={e => { e.preventDefault(); setDragOver(t.id); }}
            onDragEnd={handleDragEnd}
            onDrop={() => { setDragOver(t.id); }}
            className={`rounded-xl border bg-surface-card p-4 flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing select-none
              ${dragging === t.id  ? 'opacity-30 scale-95' : ''}
              ${dragOver === t.id && dragging !== t.id ? 'border-brand-500/60 bg-brand-500/5 scale-102' : 'border-surface-border hover:border-zinc-600'}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white select-none">
                {t.id}
              </div>
              <div className="flex gap-1">
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors"
                  onClick={e => { e.stopPropagation(); setModal({type:'edit', table:t}); }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                </button>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={e => { e.stopPropagation(); handleDelete(t.id); }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </div>
            </div>
            <div>
              <p className="text-white text-xs font-semibold leading-tight">{t.label}</p>
              <p className="text-zinc-600 text-[10px] mt-0.5">{t.seats} seats</p>
            </div>
            <span className={`self-start text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[t.status]}`}>
              {STATUS_LABEL[t.status]}
            </span>
          </div>
        ))}
        {/* Add shortcut */}
        <button onClick={() => setModal({type:'add'})}
          className="rounded-xl border-2 border-dashed border-surface-border hover:border-brand-500/40 bg-transparent p-4 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 transition-all min-h-[120px]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          <span className="text-xs">Add Table</span>
        </button>
      </div>

      {modal?.type === 'add'  && <TableModal onSave={handleAdd} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <TableModal table={modal.table} onSave={f => handleEdit(modal.table!.id, f)} onClose={() => setModal(null)} />}
    </div>
  );
}
