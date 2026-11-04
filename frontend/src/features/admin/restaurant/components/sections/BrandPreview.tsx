import { API_ORIGIN } from 'config/env';

interface Props { color: string; name: string; logo: string | null }

export default function BrandPreview({ color, name, logo }: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-surface-border" aria-hidden="true">
      <div className="flex items-center px-2.5 gap-2 overflow-x-auto no-scrollbar" style={{ background: color, height: 40 }}>
        {logo ? <img src={logo.startsWith('blob:') ? logo : `${API_ORIGIN}${logo}`} alt="" className="rounded object-cover flex-shrink-0" style={{ width: 22, height: 22 }} /> : <div className="rounded bg-white/20 flex-shrink-0" style={{ width: 22, height: 22 }} />}
        <span className="text-white text-xs font-bold flex-shrink-0 max-w-[80px] truncate">{name || 'Restaurant'}</span>
        <div className="flex gap-1 flex-shrink-0 ml-1">
          {['Waiter', 'Kitchen', 'Admin', 'Reports'].map(l => <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap" style={{ background: `${color}33`, border: `1px solid ${color}55` }}>{l}</span>)}
        </div>
      </div>
      <div className="p-2.5 bg-surface flex gap-2 items-center flex-wrap">
        <div className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap" style={{ background: color }}>Send to Kitchen</div>
        <div className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 whitespace-nowrap">Generate Bill</div>
      </div>
    </div>
  );
}
