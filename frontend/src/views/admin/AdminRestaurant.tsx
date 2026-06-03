import React, { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, uploadLogo } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Settings } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const PRESETS = ['#f97316','#e11d48','#8b5cf6','#0ea5e9','#10b981','#eab308','#6366f1','#f43f5e','#0f172a'];

export default function AdminRestaurant() {
  const [form,        setForm]        = useState<Partial<Settings>>({ restaurant_name:'', address:'', phone:'', bill_footer:'', tax_percent:'5', brand_color:'#f97316', currency_symbol:'₹' });
  const [logoUrl,     setLogoUrl]     = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const toast   = useToast();

  useEffect(() => {
    getSettings().then(s => {
      setForm(s);
      const lurl = (s as any).logo_url as string;
      if (lurl) { setLogoUrl(lurl); setLogoPreview(API_BASE + lurl); }
    }).catch(() => {});
  }, []);

  const set = (k: keyof Settings, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      toast('Settings saved — theme applied', 'success');
    } catch { toast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const res = await uploadLogo(file);
      setLogoUrl(res.logo_url);
      toast('Logo uploaded', 'success');
    } catch { toast('Logo upload failed', 'error'); setLogoPreview(''); }
    finally { setUploading(false); }
  };

  const removelogo = async () => {
    try {
      await updateSettings({ ...form, logo_url: '' } as any);
      setLogoUrl(''); setLogoPreview('');
      toast('Logo removed', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const brandColor = (form.brand_color as string) || '#f97316';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT */}
      <div className="space-y-4">
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-4">Restaurant Details</h3>
          <div className="space-y-3">
            {([
              ['restaurant_name', 'Restaurant Name', 'ABC Chicken'],
              ['address',         'Address',         '123 Main Street'],
              ['phone',           'Phone Number',    '+91 98765 43210'],
              ['bill_footer',     'Bill Footer',     'Thank you for dining with us!'],
            ] as [keyof Settings, string, string][]).map(([k,label,ph]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <input className="input" placeholder={ph} value={(form[k] as string)||''} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Currency Symbol</label><input className="input" value={(form.currency_symbol as string)||''} onChange={e => set('currency_symbol', e.target.value)} /></div>
              <div><label className="label">Tax %</label><input className="input" type="number" min="0" max="30" step="0.5" value={(form.tax_percent as string)||''} onChange={e => set('tax_percent', e.target.value)} /></div>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-3">Restaurant Logo</h3>
          <p className="text-zinc-500 text-xs mb-3">Shown next to your restaurant name in the navigation bar</p>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl border-2 border-dashed border-surface-border bg-surface-raised flex items-center justify-center cursor-pointer hover:border-brand-500/50 overflow-hidden transition-colors flex-shrink-0"
              onClick={() => logoRef.current?.click()}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                : <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              }
            </div>
            <div className="flex flex-col gap-2">
              <button className="btn btn-sm text-xs" onClick={() => logoRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload Logo'}
              </button>
              {logoPreview && (
                <button className="btn btn-sm btn-danger text-xs" onClick={removelogo}>Remove</button>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="space-y-4">
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-1">Brand Color</h3>
          <p className="text-zinc-500 text-xs mb-4">Changes header, buttons, and accents across all screens</p>

          <div className="flex items-center gap-2.5 flex-wrap mb-4">
            {PRESETS.map(c => (
              <button key={c} onClick={() => set('brand_color', c)} style={{ background: c }}
                className={`w-9 h-9 rounded-full transition-all hover:scale-110 ${brandColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-card scale-110' : ''}`} />
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border">
            <span className="text-zinc-500 text-xs flex-shrink-0">Custom</span>
            <input type="color" value={brandColor} onChange={e => set('brand_color', e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer flex-shrink-0" style={{ colorScheme: 'dark' }} />
            <input type="text" value={brandColor} onChange={e => set('brand_color', e.target.value)}
              className="input py-1.5 text-xs font-mono flex-1" placeholder="#f97316" maxLength={7} />
            <div className="w-9 h-9 rounded-lg flex-shrink-0 border border-surface-border" style={{ background: brandColor }} />
          </div>

          <div className="mt-3 h-1 rounded-full" style={{ background: brandColor }} />
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-surface-border bg-surface-card p-5">
          <h3 className="font-bold text-white text-sm mb-3">Live Preview</h3>
          <div className="rounded-xl overflow-hidden border border-surface-border">
            <div className="h-11 flex items-center px-3 gap-2" style={{ background: brandColor }}>
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                : <div className="w-6 h-6 rounded bg-white/20 flex-shrink-0" />
              }
              <span className="text-white text-sm font-bold">{(form.restaurant_name as string) || 'Restaurant'}</span>
              <div className="ml-2 flex gap-1.5">
                {['Waiter','Kitchen','Admin'].map(l => (
                  <span key={l} className="px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ background: brandColor+'33', color: '#fff', border: `1px solid ${brandColor}55` }}>{l}</span>
                ))}
              </div>
            </div>
            <div className="p-3 bg-surface text-zinc-500 text-xs space-y-1.5">
              <div className="flex gap-2 items-center">
                <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: brandColor }}>Send to Kitchen</div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Generate Bill</div>
              </div>
            </div>
          </div>
        </div>

        <button className="btn btn-brand w-full py-3 text-sm font-semibold" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        <p className="text-zinc-600 text-xs text-center">Theme color applies immediately to all open browser tabs</p>
      </div>
    </div>
  );
}
