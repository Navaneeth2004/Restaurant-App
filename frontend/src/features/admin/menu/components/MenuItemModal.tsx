import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import Toggle from 'components/ui/base/Toggle';
import { API_ORIGIN } from 'config/env';
import { useObjectUrl } from 'hooks/browser/useObjectUrl';
import type { Category, MenuItem } from 'types/restaurant/catalog';
import { buildMenuFormData, MenuFormValues, validateMenuForm } from '../hooks/menu-form';

interface Props { item?: MenuItem; categories: ReadonlyArray<Category>; busy: boolean; onSave: (fd: FormData) => void; onClose: () => void }

export default function MenuItemModal({ item, categories, busy, onSave, onClose }: Props) {
  const [v, setV] = useState<MenuFormValues>(() => ({
    name: item?.name ?? '', description: item?.description ?? '', price: item ? String(item.price) : '',
    categoryId: String(item?.category_id ?? categories[0]?.id ?? ''), available: item ? Boolean(item.available) : true, image: null,
  }));
  const [problem, setProblem] = useState<string | null>(null);
  const picked = useObjectUrl(v.image);
  const preview = picked ?? (item?.image_path ? `${API_ORIGIN}${item.image_path}` : null);
  const set = <K extends keyof MenuFormValues>(k: K, val: MenuFormValues[K]): void => { setV(p => ({ ...p, [k]: val })); setProblem(null); };
  const pick = (f: File | undefined): void => { if (f && f.type.startsWith('image/')) setV(p => ({ ...p, image: f })); };
  const submit = (): void => { const msg = validateMenuForm(v); if (msg) setProblem(msg); else onSave(buildMenuFormData(v)); };

  return (
    <Modal title={item ? 'Edit Item' : 'Add Menu Item'} className="max-w-lg" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); submit(); }}>
        <h3 className="font-bold text-white text-base mb-4">{item ? 'Edit Item' : 'Add Menu Item'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><label className="label" htmlFor="mi-name">Name</label><input id="mi-name" className="input" placeholder="Crispy Wings" maxLength={80} value={v.name} onChange={e => set('name', e.target.value)} autoFocus /></div>
            <div><label className="label" htmlFor="mi-desc">Description</label><textarea id="mi-desc" className="input resize-none" rows={2} maxLength={200} placeholder="Short description…" value={v.description} onChange={e => set('description', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="mi-price">Price</label><input id="mi-price" className="input" type="number" step="0.01" min="0" placeholder="0.00" value={v.price} onChange={e => set('price', e.target.value)} /></div>
              <div><label className="label" htmlFor="mi-cat">Category</label>
                <select id="mi-cat" className="input" value={v.categoryId} onChange={e => set('categoryId', e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="flex items-center gap-2.5"><Toggle enabled={v.available} label="Available to order" onChange={() => set('available', !v.available)} /><span className="text-sm text-zinc-300">Available to order</span></div>
          </div>
          <div>
            <span className="label">Photo</span>
            <div className="relative border-2 border-dashed border-surface-border rounded-xl overflow-hidden cursor-pointer hover:border-brand-500/60 transition-colors" role="button" tabIndex={0}
              onClick={() => document.getElementById('mi-file')?.click()} onKeyDown={e => { if (e.key === 'Enter') document.getElementById('mi-file')?.click(); }}
              onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]); }} onDragOver={e => e.preventDefault()}>
              {preview ? <img src={preview} alt="Preview" className="w-full h-48 object-cover" /> : (
                <div className="bg-surface-raised flex flex-col items-center justify-center gap-2 py-8">
                  <Icon name="image" className="w-8 h-8 text-zinc-600" strokeWidth={1.5} /><p className="text-zinc-500 text-xs">Click or drag to upload</p><p className="text-zinc-700 text-[10px]">JPG, PNG up to 5MB</p>
                </div>)}
            </div>
            <input id="mi-file" type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
            {v.image && <button type="button" className="btn btn-sm mt-2 w-full text-xs" onClick={() => setV(p => ({ ...p, image: null }))}>Discard new photo</button>}
            {!v.image && item?.image_path && <p className="text-zinc-600 text-[10px] mt-2">Pick a new photo to replace this one. A saved photo cannot be removed, only replaced.</p>}
          </div>
        </div>
        {problem && <p role="alert" className="mt-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{problem}</p>}
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-brand flex-1" disabled={busy}>{busy ? <Spinner /> : item ? 'Save Changes' : 'Add Item'}</button>
        </div>
      </form>
    </Modal>
  );
}
