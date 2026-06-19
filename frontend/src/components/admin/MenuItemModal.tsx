/**
 * components/admin/MenuItemModal.tsx
 *
 * Add / Edit menu item modal.
 * Extracted from AdminMenu.tsx.
 */

import React, { useState, useRef } from 'react';
import type { MenuItem, Category } from '../../types';

const API = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  item?:       MenuItem;
  categories:  Category[];
  onSave:      (fd: FormData) => void;
  onClose:     () => void;
}

export default function MenuItemModal({ item, categories, onSave, onClose }: Props) {
  const [name,      setName]      = useState(item?.name || '');
  const [desc,      setDesc]      = useState(item?.description || '');
  const [price,     setPrice]     = useState(String(item?.price || ''));
  const [catId,     setCatId]     = useState(String(item?.category_id || categories[0]?.id || ''));
  const [available, setAvailable] = useState(item ? Boolean(item.available) : true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview,   setPreview]   = useState<string | null>(
    item?.image_path ? `${API}${item.image_path}` : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = () => {
    if (!name || !price) return;
    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', desc);
    fd.append('price', price);
    fd.append('category_id', catId);
    fd.append('available', String(available));
    if (imageFile) fd.append('image', imageFile);
    onSave(fd);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-lg animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-white text-base mb-4">
          {item ? 'Edit Item' : 'Add Menu Item'}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Left: fields */}
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                placeholder="Crispy Wings"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Short description…"
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Price</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={catId}
                  onChange={e => setCatId(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={available}
                onClick={() => setAvailable(v => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none
                  ${available ? 'bg-brand-500 border-brand-600' : 'bg-zinc-700 border-zinc-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${available ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-zinc-300">Available to order</span>
            </label>
          </div>

          {/* Right: photo */}
          <div>
            <label className="label">Photo</label>
            <div
              className={`relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors hover:border-brand-500/60 ${
                preview
                  ? 'border-surface-border'
                  : 'border-surface-border bg-surface-raised flex flex-col items-center justify-center gap-2 py-8'
              }`}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {preview ? (
                <img src={preview} alt="preview" className="w-full h-48 object-cover" />
              ) : (
                <>
                  <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                  <p className="text-zinc-500 text-xs">Click or drag to upload</p>
                  <p className="text-zinc-700 text-[10px]">JPG, PNG up to 5MB</p>
                </>
              )}
            </div>

            {preview && (
              <button
                className="btn btn-danger btn-sm mt-2 w-full text-xs"
                onClick={e => {
                  e.stopPropagation();
                  setPreview(null);
                  setImageFile(null);
                }}
              >
                Remove
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImage}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-brand flex-1"
            onClick={submit}
            disabled={!name || !price}
          >
            {item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}