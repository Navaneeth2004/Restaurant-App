import React, { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, uploadLogo } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import AdminLockSettings from './AdminLockSettings';
import type { Settings } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
const PRESETS = ['#f97316','#e11d48','#8b5cf6','#0ea5e9','#10b981','#eab308','#6366f1','#f43f5e','#0f172a'];
const OVERDUE_PRESETS = [10, 15, 20, 30, 45, 60];

export default function AdminRestaurant() {
  const liveSettings = useSettings();

  const [form, setForm] = useState<Partial<Settings & { logo_url?: string; kitchen_overdue_mins?: string }>>(() => ({
    restaurant_name: liveSettings.restaurant_name || '',
    address:         (liveSettings as any).address         || '',
    phone:           (liveSettings as any).phone           || '',
    bill_footer:     (liveSettings as any).bill_footer     || '',
    tax_percent:     liveSettings.tax_percent              || '5',
    brand_color:     liveSettings.brand_color              || '#f97316',
    currency_symbol: liveSettings.currency_symbol          || '₹',
    kitchen_overdue_mins: (liveSettings as any).kitchen_overdue_mins || '20',
  }));

  const [logoUrl,     setLogoUrl]     = useState<string>((liveSettings as any).logo_url || '');
  const [logoPreview, setLogoPreview] = useState<string>(
    (liveSettings as any).logo_url ? API_BASE + (liveSettings as any).logo_url : ''
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeFlag,  setRemoveFlag]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const toast   = useToast();

  useEffect(() => {
    getSettings().then(s => {
      setForm(prev => ({ ...prev, ...s, kitchen_overdue_mins: (s as any).kitchen_overdue_mins || prev.kitchen_overdue_mins || '20' }));
      const lurl = (s as any).logo_url as string;
      if (lurl) {
        setLogoUrl(lurl);
        setLogoPreview(API_BASE + lurl);
      }
    }).catch(() => {});
  }, []);

  const set = (k: keyof (Settings & { logo_url?: string; kitchen_overdue_mins?: string }), v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveFlag(false);
  };

  const handleRemoveLogo = () => {
    setPendingFile(null);
    setLogoPreview('');
    setRemoveFlag(true);
    if (logoRef.current) logoRef.current.value = '';
  };

  const save = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (pendingFile) {
        const res = await uploadLogo(pendingFile);
        finalLogoUrl = res.logo_url;
        setLogoUrl(finalLogoUrl);
        setLogoPreview(API_BASE + finalLogoUrl);
        setPendingFile(null);
      }
      if (removeFlag) {
        finalLogoUrl = '';
        setLogoUrl('');
        setRemoveFlag(false);
      }
      await updateSettings({ ...form, logo_url: finalLogoUrl } as any);
      toast('Settings saved', 'success');
    } catch {
      toast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const brandColor = (form.brand_color as string) || '#f97316';
  const overdueMins = parseInt((form.kitchen_overdue_mins as string) || '20', 10) || 20;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT */}
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-border bg-surface-card p-5">
            <h3 className="font-bold text-white text-sm mb-4">Restaurant Details</h3>
            <div className="space-y-3">
              {([
                ['restaurant_name', 'Restaurant Name', 'ABC Restaurant'],
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
            <h3 className="font-bold text-white text-sm mb-1">Restaurant Logo</h3>
            <p className="text-zinc-500 text-xs mb-3">Shown next to your restaurant name in the navigation bar</p>

            {pendingFile && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                <span className="text-amber-400 text-xs">Logo ready — click <strong>Save Settings</strong> to apply</span>
              </div>
            )}

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
                <button className="btn btn-sm text-xs" onClick={() => logoRef.current?.click()}>
                  {logoPreview ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logoPreview && (
                  <button className="btn btn-sm btn-danger text-xs" onClick={handleRemoveLogo}>Remove</button>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>

          {/* Kitchen overdue threshold */}
          <div className="rounded-xl border border-surface-border bg-surface-card p-5">
            <h3 className="font-bold text-white text-sm mb-1">Kitchen Overdue Threshold</h3>
            <p className="text-zinc-500 text-xs mb-4">
              How long an order can sit in the Kitchen Display before it's flagged as <span className="text-red-400 font-semibold">Overdue</span>
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {OVERDUE_PRESETS.map(n => (
                <button
                  key={n}
                  onClick={() => set('kitchen_overdue_mins', String(n))}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                    overdueMins === n
                      ? 'bg-brand-500 border-brand-600 text-white'
                      : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
                  }`}
                >
                  {n}m
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border">
              <span className="text-zinc-500 text-xs flex-shrink-0">Custom</span>
              <input
                type="number"
                min={1}
                max={240}
                className="input py-1.5 text-xs font-mono flex-1"
                value={form.kitchen_overdue_mins as string || ''}
                onChange={e => set('kitchen_overdue_mins', e.target.value)}
              />
              <span className="text-zinc-500 text-xs flex-shrink-0">minutes</span>
            </div>
            <p className="text-zinc-600 text-[10px] mt-2">
              Orders past this time show a pulsing red "Overdue" badge in the Kitchen Display.
            </p>
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
              <input
                type="color"
                value={brandColor}
                onChange={e => set('brand_color', e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer flex-shrink-0"
                style={{ colorScheme: 'dark' }}
              />
              <input
                type="text"
                value={brandColor}
                onChange={e => set('brand_color', e.target.value)}
                className="input py-1.5 text-xs font-mono flex-1"
                placeholder="#f97316"
                maxLength={7}
              />
            </div>

            <div className="mt-3 h-1 rounded-full" style={{ background: brandColor }} />
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-surface-border bg-surface-card p-5">
            <h3 className="font-bold text-white text-sm mb-3">Live Preview</h3>
            <div className="rounded-xl overflow-hidden border border-surface-border">
              {/* Nav bar — scrollable so it never wraps on small screens */}
              <div
                className="flex items-center px-2.5 gap-2 overflow-x-auto"
                style={{ background: brandColor, height: 44, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                  : <div className="w-6 h-6 rounded bg-white/20 flex-shrink-0" />
                }
                <span className="text-white text-sm font-bold flex-shrink-0 max-w-[90px] truncate">
                  {(form.restaurant_name as string) || 'Restaurant'}
                </span>
                <div className="flex gap-1 flex-shrink-0 ml-1">
                  {['Waiter','Kitchen','Admin'].map(l => (
                    <span key={l} className="px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap"
                      style={{ background: brandColor+'33', color: '#fff', border: `1px solid ${brandColor}55` }}>{l}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-surface text-zinc-500 text-xs space-y-1.5">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap" style={{ background: brandColor }}>Send to Kitchen</div>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 whitespace-nowrap">Generate Bill</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-card p-5">
            <button className="btn btn-brand w-full py-3 text-sm font-semibold" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            <p className="text-zinc-600 text-xs text-center mt-2.5">All changes apply when you click Save Settings</p>
          </div>
        </div>
      </div>

      {/* Admin Lock Settings — full width below */}
      <AdminLockSettings />
    </div>
  );
}