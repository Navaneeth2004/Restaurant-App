import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getMenuItems, getCategories, createMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { useAdminLock } from '../../context/AdminLockContext';
import { useSortable } from '../../hooks/useSortable';
import ConfirmModal from '../../components/ConfirmModal';
import type { MenuItem, Category } from '../../types';

const API = process.env.REACT_APP_API_URL || window.location.origin;

interface ModalProps { item?: MenuItem; categories: Category[]; onSave: (fd: FormData) => void; onClose: () => void; }

function MenuItemModal({ item, categories, onSave, onClose }: ModalProps) {
  const [name,      setName]      = useState(item?.name || '');
  const [desc,      setDesc]      = useState(item?.description || '');
  const [price,     setPrice]     = useState(String(item?.price || ''));
  const [catId,     setCatId]     = useState(String(item?.category_id || categories[0]?.id || ''));
  const [available, setAvailable] = useState(item ? Boolean(item.available) : true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview,   setPreview]   = useState<string | null>(item?.image_path ? `${API}${item.image_path}` : null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setImageFile(f); setPreview(URL.createObjectURL(f));
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if (!f || !f.type.startsWith('image/')) return;
    setImageFile(f); setPreview(URL.createObjectURL(f));
  };
  const submit = () => {
    if (!name || !price) return;
    const fd = new FormData();
    fd.append('name', name); fd.append('description', desc); fd.append('price', price);
    fd.append('category_id', catId); fd.append('available', String(available));
    if (imageFile) fd.append('image', imageFile);
    onSave(fd);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-lg animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white text-base mb-4">{item ? 'Edit Item' : 'Add Menu Item'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><label className="label">Name</label><input className="input" placeholder="Crispy Wings" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
            <div><label className="label">Description</label><textarea className="input resize-none" rows={2} placeholder="Short description…" value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Price</label><input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} /></div>
              <div><label className="label">Category</label>
                <select className="input" value={catId} onChange={e => setCatId(e.target.value)}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className={`relative w-9 h-5 rounded-full border transition-colors ${available ? 'bg-brand-500 border-brand-600' : 'bg-zinc-700 border-zinc-600'}`}
                onClick={() => setAvailable(v => !v)}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${available ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-zinc-300">Available to order</span>
            </label>
          </div>
          <div>
            <label className="label">Photo</label>
            <div
              className={`relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors hover:border-brand-500/60 ${preview ? 'border-surface-border' : 'border-surface-border bg-surface-raised flex flex-col items-center justify-center gap-2 py-8'}`}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {preview
                ? <img src={preview} alt="preview" className="w-full h-48 object-cover" />
                : <>
                    <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    <p className="text-zinc-500 text-xs">Click or drag to upload</p>
                    <p className="text-zinc-700 text-[10px]">JPG, PNG up to 5MB</p>
                  </>
              }
            </div>
            {preview && <button className="btn btn-danger btn-sm mt-2 w-full text-xs" onClick={e => { e.stopPropagation(); setPreview(null); setImageFile(null); }}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-brand flex-1" onClick={submit} disabled={!name || !price}>{item ? 'Save Changes' : 'Add Item'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMenu() {
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat,  setFilterCat]  = useState<'all' | number>('all');
  const [modal,      setModal]      = useState<{ item?: MenuItem } | null>(null);
  const [confirm,    setConfirm]    = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const isSaving     = useRef(false);
  const toast    = useToast();
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';

  const load = useCallback(async () => {
    if (isSaving.current) return;
    try {
      const [m, c] = await Promise.all([getMenuItems(), getCategories()]);
      setItems(m);
      setCategories(c);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocket('menu_updated', useCallback(() => { if (!isSaving.current) load(); }, [load]));
  useSocket('categories_updated', load);

  const filtered = filterCat === 'all' ? items : items.filter(i => i.category_id === filterCat);

  // ── Reorder handler (passed to useSortable) ─────────────────────────
  const handleReorder = useCallback(async (newFiltered: MenuItem[]) => {
    // Merge reordered filtered items back into the full items list
    const othersMap = new Map(items.map(i => [i.id, i]));
    newFiltered.forEach(i => othersMap.delete(i.id));
    const others = Array.from(othersMap.values());

    // Assign globally unique sort_order values so items from different categories
    // don't collide (e.g. Drinks: 5000, 5001 — Starters: 1000, 1001)
    const withOrder = newFiltered.map((item, idx) => ({ ...item, sort_order: item.category_id * 1000 + idx }));
    const merged = [...others, ...withOrder];
    setItems(merged);

    isSaving.current = true;
    try {
      await reorderMenuItems(withOrder.map(i => ({ id: i.id, sort_order: i.sort_order ?? 0 })));
    } catch {
      toast('Failed to save order — reloading', 'error');
      await load();
    } finally {
      // Hold the flag for a moment so socket events don't clobber our optimistic state
      setTimeout(() => { isSaving.current = false; }, 2000);
    }
  }, [items, load, toast]);

  const { getItemProps, draggingId, dragOverId } = useSortable({
    items: filtered,
    getId: item => item.id,
    onReorder: handleReorder,
  });

  const toggleAvail = async (item: MenuItem) => {
    const fd = new FormData();
    fd.append('available', String(!item.available));
    try { await updateMenuItem(item.id, fd); load(); } catch { toast('Failed', 'error'); }
  };

  const handleSave = async (fd: FormData) => {
    try {
      if (modal?.item) { await updateMenuItem(modal.item.id, fd); toast('Updated', 'success'); }
      else             { await createMenuItem(fd);               toast('Added', 'success'); }
      setModal(null);
      load();
    } catch (e: any) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const handleDelete = (id: number) => {
    setConfirm({
      title: 'Delete Menu Item',
      message: 'This will permanently remove the item from the menu. This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null);
        try { await deleteMenuItem(id); toast('Deleted', 'success'); load(); }
        catch (e: any) { toast(e.response?.data?.error || 'Failed — item may be in an active order', 'error'); }
      },
    });
  };

  return (
    <div>
      {confirm && (
        <ConfirmModal title={confirm.title} message={confirm.message} confirmLabel="Delete" danger onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">Menu Items</h3>
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
          <button className="btn btn-brand btn-sm" onClick={() => setModal({})}>+ Add Item</button>
        </div>

        {/* Hint */}
        <p className="text-zinc-600 text-[10px] mb-2">
          {window.matchMedia('(pointer: coarse)').matches
            ? 'Long-press and drag to reorder'
            : 'Drag to reorder'}
        </p>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setFilterCat('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterCat === 'all' ? 'bg-brand-500 text-white border-brand-600' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}>
            All ({items.length})
          </button>
          {categories.map(c => {
            const count = items.filter(i => i.category_id === c.id).length;
            return (
              <button key={c.id} onClick={() => setFilterCat(c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterCat === c.id ? 'bg-brand-500 text-white border-brand-600' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}>
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(item => {
          const itemProps = getItemProps(item.id);
          return (
            <div
              key={item.id}
              {...itemProps}
              className={`rounded-xl border bg-surface-card overflow-hidden transition-colors select-none
                ${item.available ? '' : 'opacity-60'}
                ${draggingId === item.id ? 'border-brand-500/40' : dragOverId === item.id && draggingId !== item.id ? 'border-brand-500' : 'border-surface-border hover:border-zinc-600'}
              `}
              // Merge the style from getItemProps with a rounded border on the outline
              style={{ ...itemProps.style, borderRadius: '0.75rem' }}
            >
              <div className="relative h-36 bg-surface-raised">
                {item.image_path
                  ? <img src={`${API}${item.image_path}`} alt={item.name} className="w-full h-full object-cover pointer-events-none" />
                  : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-700">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg>
                      <span className="text-xs">No image</span>
                    </div>
                }
                {!item.available && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-red-500/80 px-2 py-0.5 rounded-full">Sold Out</span>
                  </div>
                )}
                {/* Drag handle indicator */}
                <div className="absolute top-2 left-2 pointer-events-none">
                  <div className="w-5 h-5 rounded bg-black/30 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute top-2 right-2">
                  <div className={`relative w-9 h-5 rounded-full border cursor-pointer transition-colors shadow-md ${item.available ? 'bg-brand-500 border-brand-600' : 'bg-zinc-700 border-zinc-600'}`}
                    onClick={e => { e.stopPropagation(); toggleAvail(item); }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.available ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                    {item.description && <p className="text-zinc-500 text-xs mt-0.5 truncate">{item.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-brand-400 text-sm font-semibold">{sym}{parseFloat(String(item.price)).toFixed(2)}</span>
                      <span className="text-zinc-600 text-[10px]">·</span>
                      <span className="text-zinc-600 text-[10px]">{item.category_name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-raised transition-colors"
                      onClick={e => { e.stopPropagation(); setModal({ item }); }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                    </button>
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={e => { e.stopPropagation(); handleDelete(item.id); }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-zinc-600 text-sm col-span-full text-center py-10">No items</p>}
      </div>

      {modal && <MenuItemModal item={modal.item} categories={categories} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Auth token helpers ───────────────────────────────────────────────────────
const BASE = process.env.REACT_APP_API_URL || window.location.origin;
let _tok: string | null = null;
async function tok(): Promise<string | null> {
  if (_tok !== null) return _tok;
  try { const r = await fetch(`${BASE}/api/auth/token`); const d = await r.json(); _tok = d.token ?? null; return _tok; } catch { return null; }
}
async function authedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const t = await tok();
  const h: Record<string, string> = { ...(opts.headers as any || {}) };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return fetch(url, { ...opts, headers: h });
}

// ── Export / Import panel ────────────────────────────────────────────────────
export function MenuExportImport() {
  const [importing,    setImporting]    = React.useState(false);
  const [importResult, setImportResult] = React.useState<string | null>(null);
  const [importError,  setImportError]  = React.useState<string | null>(null);
  const [exporting,    setExporting]    = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const toast   = useToast();
  const { requirePin, config: lockConfig } = useAdminLock();

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await authedFetch(`${BASE}/api/export/menu`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || `Export failed (${res.status})`);
      }
      const blob    = await res.blob();
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download    = `menu_export_${dateStr}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Menu exported', 'success');
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (!lockConfig.enabled) { doExport(); return; }
    requirePin(doExport, 'Export Menu', 'Enter admin PIN to download menu');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const doImport = async () => {
      setImporting(true);
      setImportResult(null);
      setImportError(null);
      try {
        let res: Response;
        if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
          const fd = new FormData();
          fd.append('menuzip', file);
          res = await authedFetch(`${BASE}/api/export/menu/import`, { method: 'POST', body: fd });
        } else if (file.name.endsWith('.json') || file.type === 'application/json') {
          const text = await file.text();
          const data = JSON.parse(text);
          res = await authedFetch(`${BASE}/api/export/menu/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
        } else {
          throw new Error('Please choose a .zip or .json file');
        }
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Import failed');
        const imgNote = result.images_imported > 0 ? `, ${result.images_imported} images` : '';
        setImportResult(`Done — ${result.categories_added} categories added, ${result.items_added} items added${imgNote}, ${result.items_skipped} skipped`);
        toast('Menu imported successfully', 'success');
      } catch (e: any) {
        const msg = e.message || 'Import failed — check file format';
        setImportError(msg);
        toast(msg, 'error');
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };

    if (!lockConfig.enabled) { doImport(); return; }
    requirePin(doImport, 'Import Menu', 'Enter admin PIN to import menu');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="font-bold text-white text-sm mb-1">Export / Import Menu</h3>
      <p className="text-zinc-500 text-xs mb-4">Move your full menu — including item photos — to another device or create a backup</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            <span className="text-white text-xs font-semibold">Export Menu</span>
            {lockConfig.enabled && (
              <svg className="w-3 h-3 text-zinc-600 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            )}
          </div>
          <p className="text-zinc-600 text-xs mb-3">Downloads a <span className="text-zinc-400 font-mono">.zip</span> with all categories, items and photos.</p>
          <button className="btn btn-brand btn-sm w-full" onClick={handleExport} disabled={exporting}>
            {exporting ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Exporting…</span> : 'Download menu.zip'}
          </button>
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21" /></svg>
            <span className="text-white text-xs font-semibold">Import Menu</span>
            {lockConfig.enabled && (
              <svg className="w-3 h-3 text-zinc-600 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            )}
          </div>
          <p className="text-zinc-600 text-xs mb-3">Upload a <span className="text-zinc-400 font-mono">.zip</span> or <span className="text-zinc-400 font-mono">.json</span>. Existing items are kept; duplicates skipped.</p>
          <button className="btn btn-sm w-full border-surface-border" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-400 rounded-full animate-spin" />Importing…</span> : 'Choose .zip or .json'}
          </button>
          <input ref={fileRef} type="file" accept=".zip,.json,application/zip,application/x-zip-compressed,application/json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>
      {importResult && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {importResult}
        </div>
      )}
      {importError && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {importError}
        </div>
      )}
    </div>
  );
}