import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMenuItems, getCategories, createMenuItem, updateMenuItem,
  deleteMenuItem, reorderMenuItems,
} from '../../services/api';
import { useSocket }      from '../../hooks/useSocket';
import { useToast }       from '../../context/ToastContext';
import { useSettings }    from '../../context/SettingsContext';
import { useSortable }    from '../../hooks/useSortable';
import ConfirmModal       from '../../components/ConfirmModal';
import MenuItemModal      from '../../components/admin/MenuItemModal';
import type { MenuItem, Category } from '../../types';

const API = process.env.REACT_APP_API_URL || window.location.origin;

export default function AdminMenu() {
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat,  setFilterCat]  = useState<'all' | number>('all');
  const [modal,      setModal]      = useState<{ item?: MenuItem } | null>(null);
  const [confirm,    setConfirm]    = useState<{
    title: string; message: string; onConfirm: () => void;
  } | null>(null);

  const isSaving             = useRef(false);
  const reorderDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast    = useToast();
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';

  const load = useCallback(async () => {
    if (isSaving.current) return;
    try {
      const [m, c] = await Promise.all([getMenuItems(), getCategories()]);
      if (isSaving.current) return;
      setItems(m);
      setCategories(c);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useSocket('menu_updated',       useCallback(() => { if (!isSaving.current) load(); }, [load]));
  useSocket('categories_updated', useCallback(() => { if (!isSaving.current) load(); }, [load]));

  const filtered = filterCat === 'all' ? items : items.filter(i => i.category_id === filterCat);

  // ── Reorder ───────────────────────────────────────────────────────────
  const handleReorder = (newFiltered: MenuItem[]) => {
    const filteredIds = new Set(newFiltered.map(i => i.id));
    const others      = items.filter(i => !filteredIds.has(i.id));
    const merged      = [...newFiltered, ...others];

    isSaving.current = true;
    setItems(merged);

    if (reorderDebounceTimer.current) clearTimeout(reorderDebounceTimer.current);
    reorderDebounceTimer.current = setTimeout(async () => {
      try {
        await reorderMenuItems(
          newFiltered.map((item, idx) => ({
            id: item.id,
            sort_order: item.category_id * 10000 + idx,
          }))
        );
      } catch (err) {
        console.error('Reorder save failed:', err);
        load();
      } finally {
        setTimeout(() => { isSaving.current = false; }, 1500);
      }
    }, 300);
  };

  const { getItemProps, draggingId, dragOverId } = useSortable({
    items: filtered,
    getId: item => item.id,
    onReorder: handleReorder,
  });

  const toggleAvail = async (item: MenuItem) => {
    const fd = new FormData();
    fd.append('available', String(!item.available));
    try { await updateMenuItem(item.id, fd); load(); }
    catch { toast('Failed', 'error'); }
  };

  const handleSave = async (fd: FormData) => {
    try {
      if (modal?.item) { await updateMenuItem(modal.item.id, fd); toast('Updated', 'success'); }
      else             { await createMenuItem(fd);               toast('Added',   'success'); }
      setModal(null);
      load();
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed', 'error');
    }
  };

  const handleDelete = (id: number) => {
    setConfirm({
      title: 'Delete Menu Item',
      message: 'This will permanently remove the item from the menu. This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null);
        try { await deleteMenuItem(id); toast('Deleted', 'success'); load(); }
        catch (e: any) {
          toast(e.response?.data?.error || 'Failed — item may be in an active order', 'error');
        }
      },
    });
  };

  return (
    <div>
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Delete"
          danger
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">Menu Items</h3>
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
          <button className="btn btn-brand btn-sm" onClick={() => setModal({})}>+ Add Item</button>
        </div>

        <p className="text-zinc-600 text-[10px] mb-2">
          {window.matchMedia('(pointer: coarse)').matches ? 'Long-press and drag to reorder' : 'Drag to reorder'}
        </p>

        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setFilterCat('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filterCat === 'all'
                ? 'bg-brand-500 text-white border-brand-600'
                : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            All ({items.length})
          </button>
          {categories.map(c => {
            const count = items.filter(i => i.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterCat === c.id
                    ? 'bg-brand-500 text-white border-brand-600'
                    : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(item => {
          const itemProps = getItemProps(item.id);
          return (
            <div
              key={item.id}
              {...itemProps}
              className={`rounded-xl border bg-surface-card overflow-hidden transition-colors select-none
                ${item.available ? '' : 'opacity-60'}
                ${draggingId === item.id
                  ? 'border-brand-500/40'
                  : dragOverId === item.id && draggingId !== item.id
                    ? 'border-brand-500'
                    : 'border-surface-border hover:border-zinc-600'}
              `}
              style={{ ...itemProps.style, borderRadius: '0.75rem' }}
            >
              {/* Image area */}
              <div className="relative h-36 bg-surface-raised">
                {item.image_path ? (
                  <img
                    src={`${API}${item.image_path}`}
                    alt={item.name}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-700">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                    <span className="text-xs">No image</span>
                  </div>
                )}

                {!item.available && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-red-500/80 px-2 py-0.5 rounded-full">
                      Sold Out
                    </span>
                  </div>
                )}

                {/* Availability toggle */}
                <div className="absolute top-2 right-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(item.available)}
                    onClick={e => { e.stopPropagation(); toggleAvail(item); }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-colors shadow-md focus:outline-none
                      ${item.available ? 'bg-brand-500 border-brand-600' : 'bg-zinc-700 border-zinc-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                      ${item.available ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Info row */}
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-brand-400 text-sm font-semibold">
                        {sym}{parseFloat(String(item.price)).toFixed(2)}
                      </span>
                      <span className="text-zinc-600 text-[10px]">·</span>
                      <span className="text-zinc-600 text-[10px]">{item.category_name}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors"
                      onClick={e => { e.stopPropagation(); setModal({ item }); }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-zinc-600 text-sm col-span-full text-center py-10">No items</p>
        )}
      </div>

      {modal && (
        <MenuItemModal
          item={modal.item}
          categories={categories}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}