import Icon from 'components/ui/base/Icon';
import { timeAgo } from 'lib/format/local-time';
import type { Device } from 'types/core/auth';

export default function DeviceRow({ device: d, onRemove }: { device: Device; onRemove: (d: Device) => void }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center flex-shrink-0"><Icon name="phone" className="w-4 h-4 text-zinc-400" strokeWidth={1.8} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white text-sm font-semibold truncate">{d.name}</span>
          {d.is_current && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">This device</span>}
          {d.role_lock && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">{d.role_lock} only</span>}
        </div>
        <p className="text-zinc-500 text-[11px] mt-0.5">Last used {timeAgo(d.last_seen_at)} · added {timeAgo(d.created_at)}{d.created_via === 'pairing' ? ' with a code' : d.created_via ? ' by owner login' : ''}</p>
      </div>
      <button type="button" onClick={() => onRemove(d)} className="text-xs font-semibold text-red-400/80 hover:text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors flex-shrink-0">Remove</button>
    </div>
  );
}
