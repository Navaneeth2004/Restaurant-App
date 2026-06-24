import React, { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, uploadLogo } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import AdminLockSettings from './AdminLockSettings';
import { TogglePill } from './AdminLockSettings';
import type { Settings } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
const PRESETS = ['#f97316','#e11d48','#8b5cf6','#0ea5e9','#10b981','#eab308','#6366f1','#f43f5e','#0f172a'];
const OVERDUE_PRESETS = [10, 15, 20, 30, 45, 60];

// All Indian states/UTs with GST state codes
const INDIAN_STATES: { name: string; code: string }[] = [
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Puducherry', code: '34' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
];

// ── Shared section wrapper ───────────────────────────────────────────────
function SectionCard({
  title, badge, desc, children,
}: { title: string; badge?: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold text-white text-sm">{title}</h3>
        {badge && (
          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {desc && <p className="text-zinc-500 text-xs mb-4 leading-relaxed">{desc}</p>}
      <div className={desc ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

export default function AdminRestaurant() {
  const liveSettings = useSettings();

  const [form, setForm] = useState<Partial<Settings & {
    logo_url?: string;
    kitchen_overdue_mins?: string;
    gstin?: string;
    legal_name?: string;
    state_name?: string;
    sac_code?: string;
    b2b_enabled?: string;
  }>>(() => ({
    restaurant_name:      liveSettings.restaurant_name || '',
    address:              (liveSettings as any).address              || '',
    phone:                (liveSettings as any).phone                || '',
    bill_footer:          (liveSettings as any).bill_footer          || '',
    tax_percent:          liveSettings.tax_percent                   || '5',
    brand_color:          liveSettings.brand_color                   || '#f97316',
    currency_symbol:      liveSettings.currency_symbol               || '₹',
    kitchen_overdue_mins: (liveSettings as any).kitchen_overdue_mins || '20',
    gstin:                (liveSettings as any).gstin                || '',
    legal_name:           (liveSettings as any).legal_name           || '',
    state_name:           (liveSettings as any).state_name           || 'Kerala',
    sac_code:             (liveSettings as any).sac_code             || '9963',
    b2b_enabled:          (liveSettings as any).b2b_enabled          || 'false',
  }));

  const [logoUrl,     setLogoUrl]     = useState<string>((liveSettings as any).logo_url || '');
  const [logoPreview, setLogoPreview] = useState<string>(
    (liveSettings as any).logo_url ? API_BASE + (liveSettings as any).logo_url : ''
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeFlag,  setRemoveFlag]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const toast   = useToast();

  useEffect(() => {
    getSettings().then(s => {
      setForm(prev => ({
        ...prev,
        ...s,
        kitchen_overdue_mins: (s as any).kitchen_overdue_mins || prev.kitchen_overdue_mins || '20',
        gstin:       (s as any).gstin       || '',
        legal_name:  (s as any).legal_name  || '',
        state_name:  (s as any).state_name  || 'Kerala',
        sac_code:    (s as any).sac_code    || '9963',
        b2b_enabled: (s as any).b2b_enabled || 'false',
      }));
      const lurl = (s as any).logo_url as string;
      if (lurl) {
        setLogoUrl(lurl);
        setLogoPreview(API_BASE + lurl);
      }
    }).catch(() => {});
  }, []);

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveFlag(false);
    setSaved(false);
  };

  const handleRemoveLogo = () => {
    setPendingFile(null);
    setLogoPreview('');
    setRemoveFlag(true);
    setSaved(false);
    if (logoRef.current) logoRef.current.value = '';
  };

  const save = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (pendingFile) {
        const { uploadLogo: ul } = await import('../../services/api');
        const res = await ul(pendingFile);
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
      setSaved(true);
    } catch {
      toast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const brandColor    = (form.brand_color as string) || '#f97316';
  const overdueMins   = parseInt((form.kitchen_overdue_mins as string) || '20', 10) || 20;
  const b2bEnabled    = form.b2b_enabled === 'true';
  const selectedState = INDIAN_STATES.find(s => s.name === form.state_name);
  const gstFilledIn   = !!(form.gstin as string)?.trim();

  return (
    <div className="space-y-5 pb-2">

      {/* ── 1. Identity — name, logo, contact, bill footer ──────────── */}
      <SectionCard title="Restaurant Identity" desc="Shown on bills, the navigation bar, and the login screen.">
        <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-5">
          {/* Logo */}
          <div className="flex flex-col items-center gap-2 lg:w-28">
            <div
              className="w-24 h-24 rounded-xl border-2 border-dashed border-surface-border bg-surface-raised flex items-center justify-center cursor-pointer hover:border-brand-500/50 overflow-hidden transition-colors flex-shrink-0"
              onClick={() => logoRef.current?.click()}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                : <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              }
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <button className="btn btn-sm text-[11px] w-full" onClick={() => logoRef.current?.click()}>
                {logoPreview ? 'Change' : 'Upload logo'}
              </button>
              {logoPreview && (
                <button className="btn btn-sm btn-danger text-[11px] w-full" onClick={handleRemoveLogo}>Remove</button>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            {pendingFile && (
              <p className="text-amber-400 text-[10px] text-center leading-snug">Save to apply</p>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-3 min-w-0">
            <div>
              <label className="label">Restaurant Name</label>
              <input className="input" placeholder="ABC Restaurant" value={(form.restaurant_name as string) || ''} onChange={e => set('restaurant_name', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Phone Number</label>
                <input className="input" placeholder="+91 98765 43210" value={(form.phone as string) || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" placeholder="123 Main Street" value={(form.address as string) || ''} onChange={e => set('address', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Bill Footer</label>
              <input className="input" placeholder="Thank you for dining with us!" value={(form.bill_footer as string) || ''} onChange={e => set('bill_footer', e.target.value)} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Money & Tax — the field that drives bills + filings ──── */}
      <SectionCard
        title="Currency & Tax"
        desc="Controls every bill total, report figure, and tax filing export in this app."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Currency Symbol</label>
            <input className="input" value={(form.currency_symbol as string) || ''} onChange={e => set('currency_symbol', e.target.value)} />
          </div>
          <div>
            <label className="label">Tax % (GST)</label>
            <div className="relative">
              <input
                className="input pr-9 font-mono"
                type="number" min="0" max="30" step="0.5"
                value={(form.tax_percent as string) || ''}
                onChange={e => set('tax_percent', e.target.value)}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">%</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-brand-500/8 border border-brand-500/20">
          <svg className="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-zinc-400 text-[11px] leading-snug">
            <span className="text-zinc-300 font-medium">Most standalone restaurants: 5%.</span>{' '}
            Restaurants inside hotels with high room tariffs, or outdoor caterers, are usually 18%.
            Check with your CA if you're unsure — this number also generates your GST filings below.
          </p>
        </div>
      </SectionCard>

      {/* ── 3. GST Registration — identity + B2B behavior, together ── */}
      <SectionCard
        title="GST Registration"
        badge={gstFilledIn ? 'Registered' : 'Optional'}
        desc="Only needed if you're GST-registered. Used to generate GSTR-1 and GSTR-3B filings in Reports → Export. Leave blank otherwise."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">GSTIN</label>
            <input
              className="input font-mono uppercase"
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              value={(form.gstin as string) || ''}
              onChange={e => set('gstin', e.target.value.toUpperCase())}
            />
            <p className="text-zinc-700 text-[10px] mt-1">15-character GST Identification Number</p>
          </div>
          <div>
            <label className="label">Legal Business Name</label>
            <input
              className="input"
              placeholder="As per GST registration"
              value={(form.legal_name as string) || ''}
              onChange={e => set('legal_name', e.target.value)}
            />
            <p className="text-zinc-700 text-[10px] mt-1">Exact name on your GST certificate</p>
          </div>
          <div>
            <label className="label">State / Place of Supply</label>
            <select
              className="input"
              value={(form.state_name as string) || 'Kerala'}
              onChange={e => set('state_name', e.target.value)}
            >
              {INDIAN_STATES.map(s => (
                <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
              ))}
            </select>
            <p className="text-zinc-700 text-[10px] mt-1">
              State code <span className="font-mono text-zinc-500">{selectedState?.code || '32'}</span> — used in GSTR-1 JSON
            </p>
          </div>
          <div>
            <label className="label">SAC Code</label>
            <input
              className="input font-mono"
              placeholder="9963"
              value={(form.sac_code as string) || '9963'}
              onChange={e => set('sac_code', e.target.value)}
            />
            <p className="text-zinc-700 text-[10px] mt-1">9963 = Restaurant services (default)</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-surface-border">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <TogglePill
              enabled={b2bEnabled}
              onChange={() => set('b2b_enabled', b2bEnabled ? 'false' : 'true')}
            />
            <div>
              <span className="text-sm font-medium text-white">Enable B2B Invoicing</span>
              <p className="text-zinc-600 text-xs leading-relaxed mt-0.5">
                Adds a "Customer GSTIN" field at payment time. Filled invoices go into the
                B2B section of GSTR-1 instead of the B2CS aggregate. Leave off for 100% walk-in customers.
              </p>
            </div>
          </label>
        </div>
      </SectionCard>

      {/* ── 4. Branding + 5. Operations, side by side on wide screens ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Branding */}
        <SectionCard title="Brand Color" desc="Changes the header, buttons, and accents across every screen.">
          <div className="flex items-center gap-2.5 flex-wrap mb-4">
            {PRESETS.map(c => (
              <button key={c} onClick={() => set('brand_color', c)} style={{ background: c }}
                className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${brandColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-card scale-110' : ''}`} />
            ))}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border mb-4">
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

          {/* Live preview, now living right under the color it previews */}
          <div className="rounded-xl overflow-hidden border border-surface-border">
            <div
              className="flex items-center px-2.5 gap-2 overflow-x-auto"
              style={{ background: brandColor, height: 40, scrollbarWidth: 'none' }}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="rounded object-cover flex-shrink-0" style={{ width: 22, height: 22 }} />
                : <div className="rounded bg-white/20 flex-shrink-0" style={{ width: 22, height: 22 }} />
              }
              <span className="text-white text-xs font-bold flex-shrink-0 max-w-[80px] truncate">
                {(form.restaurant_name as string) || 'Restaurant'}
              </span>
              <div className="flex gap-1 flex-shrink-0 ml-1">
                {['Waiter', 'Kitchen', 'Admin', 'Reports', 'Export', 'Backup', 'Ticket'].map(l => (
                  <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                    style={{ background: brandColor + '33', color: '#fff', border: `1px solid ${brandColor}55` }}>{l}</span>
                ))}
              </div>
            </div>
            <div className="p-2.5 bg-surface flex gap-2 items-center flex-wrap">
              <div className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap" style={{ background: brandColor }}>Send to Kitchen</div>
              <div className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 whitespace-nowrap">Generate Bill</div>
            </div>
          </div>
        </SectionCard>

        {/* Operations */}
        <SectionCard
          title="Kitchen Overdue Threshold"
          desc="How long an order sits in the Kitchen Display before it's flagged as overdue."
        >
          <div className="grid grid-cols-3 gap-2 mb-3">
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
              type="number" min={1} max={240}
              className="input py-1.5 text-xs font-mono flex-1"
              value={(form.kitchen_overdue_mins as string) || ''}
              onChange={e => set('kitchen_overdue_mins', e.target.value)}
            />
            <span className="text-zinc-500 text-xs flex-shrink-0">minutes</span>
          </div>
        </SectionCard>
      </div>

      {/* ── Single save action for the whole page ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-t border-surface-border">
        <button className="btn btn-brand w-full sm:w-auto px-6 py-2.5 text-sm font-semibold flex items-center justify-center gap-2" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Save Settings
            </>
          )}
        </button>
        {saved && !saving && (
          <span className="text-emerald-400 text-xs flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            All changes saved
          </span>
        )}
        {!saved && !saving && (
          <span className="text-zinc-600 text-xs text-center sm:text-left">Saves everything above, including GST and branding</span>
        )}
      </div>

      {/* Admin Lock Settings */}
      <AdminLockSettings />
    </div>
  );
}