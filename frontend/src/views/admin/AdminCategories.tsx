import React, { useState, useEffect, useCallback } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import type { Category } from '../../types';

export default function AdminCategories() {
  const [cats,    setCats]    = useState<Category[]>([]);
  const [counts,  setCounts]  = useState<Record<number,number>>({});
  const [newName, setNewName] = useState('');
  const [editId,  setEditId]  = useState<number|null>(null);
  const [editVal, setEditVal] = useState('');
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([getCategories(), getMenuItems()]);
      setCats(c);
      const cnt: Record<number,number> = {};
      m.forEach(item => { cnt[item.category_id] = (cnt[item.category_id]||0)+1; });
      setCounts(cnt);
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);
  useSocket('categories_updated', load);
  useSocket('menu_updated', load);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try { await createCategory(newName.trim()); toast('Category added', 'success'); setNewName(''); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Failed', 'error'); }
  };

  const handleEdit = async (id: number) => {
    if (!editVal.trim()) return;
    try { await updateCategory(id, { name: editVal.trim() }); toast('Renamed', 'success'); setEditId(null); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Failed', 'error'); }
  };

  const handleDeleteConfirmed = async (id: number) => {
    setConfirm(null);
    try { await deleteCategory(id); toast('Deleted', 'success'); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Cannot delete — has menu items', 'error'); }
  };

  return (
    <>
      {confirm && (
        <ConfirmModal
          title="Delete Category"
          message={`Delete "${confirm.name}"? This cannot be undone. Categories with menu items cannot be deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDeleteConfirmed(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Add form */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-bold text-white text-sm">Menu Categories</h3>
            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{cats.length}</span>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-card p-4 mb-4">
            <h4 className="text-zinc-400 text-xs font-semibold mb-3">Add New Category</h4>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. Specials, Combos…" value={newName} onChange={e => setNewName(e.target.value)} />
              <button type="submit" className="btn btn-brand flex-shrink-0">Add</button>
            </form>
          </div>
          <p className="text-zinc-600 text-xs mb-2">Tip: categories cannot be deleted while they contain items</p>
        </div>

        {/* Right: Category list */}
        <div>
          <h3 className="font-bold text-white text-sm mb-4 lg:block hidden">&nbsp;</h3>
          <div className="space-y-2">
            {cats.map(cat => (
              <div key={cat.id} className="rounded-xl border border-surface-border bg-surface-card px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>
                {editId === cat.id ? (
                  <>
                    <input className="input flex-1 py-1.5 text-sm" value={editVal} onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if(e.key==='Enter') handleEdit(cat.id); if(e.key==='Escape') setEditId(null); }} autoFocus />
                    <button className="btn btn-brand btn-sm" onClick={() => handleEdit(cat.id)}>Save</button>
                    <button className="btn btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-white text-sm font-medium">{cat.name}</span>
                    <span className="text-zinc-600 text-xs font-mono">{counts[cat.id]||0} items</span>
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors"
                      onClick={() => { setEditId(cat.id); setEditVal(cat.name); }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                    </button>
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={() => setConfirm({ id: cat.id, name: cat.name })}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </>
                )}
              </div>
            ))}
            {cats.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">No categories yet</p>}
          </div>
        </div>
      </div>
    </>
  );
}