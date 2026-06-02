import React, { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Settings } from '../../types';

const PRESETS = ['#f97316','#e11d48','#8b5cf6','#0ea5e9','#10b981','#eab308','#6366f1','#f43f5e','#0f172a'];

export default function AdminRestaurant() {
  const [form,   setForm]   = useState<Partial<Settings>>({ restaurant_name:'', address:'', phone:'', bill_footer:'', tax_percent:'5', brand_color:'#f97316', currency_symbol:'₹' });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => { getSettings().then(s => setForm(s)).catch(() => {}); }, []);

  const set = (k: keyof Settings, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await updateSettings(form); toast('Settings saved', 'success'); }
    catch { toast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  return (
    // FIX #11: 2-col grid to use the full width
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Left column */}
      <div className="space-y-4">
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-4">Restaurant Details</h3>
          <div className="space-y-3">
            <div><label className="label">Restaurant Name</label><input className="input" placeholder="ABC Chicken" value={(form.restaurant_name as string)||''} onChange={e => set('restaurant_name', e.target.value)} /></div>
            <div><label className="label">Address</label><input className="input" placeholder="123 Main Street" value={(form.address as string)||''} onChange={e => set('address', e.target.value)} /></div>
            <div><label className="label">Phone Number</label><input className="input" placeholder="+91 98765 43210" value={(form.phone as string)||''} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Bill Footer</label><input className="input" placeholder="Thank you for dining with us!" value={(form.bill_footer as string)||''} onChange={e => set('bill_footer', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Currency Symbol</label><input className="input" value={(form.currency_symbol as string)||''} onChange={e => set('currency_symbol', e.target.value)} /></div>
              <div><label className="label">Tax %</label><input className="input" type="number" min="0" max="30" step="0.5" value={(form.tax_percent as string)||''} onChange={e => set('tax_percent', e.target.value)} /></div>
            </div>
          </div>
        </div>

        {/* Logo upload */}
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-3">Restaurant Logo</h3>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl border-2 border-dashed border-surface-border bg-surface-raised flex items-center justify-center cursor-pointer hover:border-brand-500/50 overflow-hidden transition-colors flex-shrink-0"
              onClick={() => logoRef.current?.click()}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                : <svg className="w-6 h-6 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              }
            </div>
            <div>
              <button className="btn btn-sm text-xs" onClick={() => logoRef.current?.click()}>Upload Logo</button>
              {logoPreview && <button className="btn btn-sm btn-danger text-xs ml-2" onClick={() => { setLogoPreview(null); setLogoFile(null); }}>Remove</button>}
              <p className="text-zinc-600 text-[10px] mt-1.5">Shown in the top navigation bar</p>
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }}} />
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {/* Brand color — FIX #12: cleaner custom color picker */}
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-4">Brand Color</h3>
          <div className="flex items-center gap-2.5 flex-wrap mb-4">
            {PRESETS.map(c => (
              <button
                key={c}
                onClick={() => set('brand_color', c)}
                style={{ background: c }}
                className={`w-9 h-9 rounded-full transition-all ${(form.brand_color as string) === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-card scale-110' : 'hover:scale-110 hover:ring-1 hover:ring-white/30'}`}
              />
            ))}
          </div>

          {/* FIX #12: Clean custom color row */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border">
            <label className="text-xs text-zinc-400 flex-shrink-0">Custom</label>
            <div className="relative flex-shrink-0">
              <input
                type="color"
                value={(form.brand_color as string)||'#f97316'}
                onChange={e => set('brand_color', e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0.5"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <input
              type="text"
              value={(form.brand_color as string)||''}
              onChange={e => set('brand_color', e.target.value)}
              className="input py-1.5 text-xs font-mono flex-1"
              placeholder="#f97316"
              maxLength={7}
            />
            <div className="w-9 h-9 rounded-lg flex-shrink-0 border border-surface-border" style={{ background: (form.brand_color as string)||'#f97316' }} />
          </div>

          <div className="mt-3 h-1.5 rounded-full" style={{ background: (form.brand_color as string)||'#f97316' }} />
          <p className="text-zinc-600 text-xs mt-2">Color updates instantly across all screens after saving</p>
        </div>

        {/* Preview card */}
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-3">Preview</h3>
          <div className="rounded-xl overflow-hidden border border-surface-border">
            <div className="h-10 flex items-center px-4 gap-2.5" style={{ background: (form.brand_color as string)||'#f97316' }}>
              <div className="w-6 h-6 rounded-md bg-white/20" />
              <span className="text-white text-sm font-bold">{(form.restaurant_name as string) || 'Restaurant Name'}</span>
            </div>
            <div className="p-4 bg-surface text-zinc-400 text-xs space-y-1.5">
              <div className="flex gap-2">
                {['Waiter','Kitchen','Admin'].map(l => (
                  <span key={l} className="px-2.5 py-1 rounded-lg text-xs" style={{ background: (form.brand_color as string)+'22', color: form.brand_color as string, border: `1px solid ${form.brand_color}44` }}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button className="btn btn-brand w-full py-3" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
