import Icon from 'components/ui/base/Icon';
import type { Role } from 'config/constants';
import type { Staff } from 'types/core/auth';
import { ROLE_STYLES } from '../hooks/staff-rules';

interface Props {
  role: Role; members: ReadonlyArray<Staff>; blocker: (s: Staff) => string | null;
  onPin: (s: Staff) => void; onDelete: (s: Staff) => void;
}

export default function StaffColumn({ role, members, blocker, onPin, onDelete }: Props) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
        <span className={`text-xs font-bold capitalize px-2.5 py-0.5 rounded-full border ${ROLE_STYLES[role]}`}>{role}</span>
        <span className="text-zinc-600 text-xs ml-auto">{members.length}</span>
      </div>
      <div className="p-3 space-y-2">
        {members.map(s => {
          const why = blocker(s);
          return (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-raised">
              <div className="w-8 h-8 rounded-full bg-brand-500/15 border border-brand-500/20 flex items-center justify-center font-bold text-brand-400 text-sm flex-shrink-0">{s.name.charAt(0).toUpperCase()}</div>
              <span className="flex-1 text-white text-sm font-medium truncate">{s.name}</span>
              <button type="button" aria-label={`Change PIN for ${s.name}`} title="Change PIN" className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors" onClick={() => onPin(s)}><Icon name="key" className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label={`Remove ${s.name}`} title={why ?? 'Remove staff member'} disabled={why !== null} onClick={() => onDelete(s)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${why === null ? 'text-red-500/40 hover:text-red-400 hover:bg-red-500/10' : 'text-zinc-700 cursor-not-allowed'}`}><Icon name="trash" className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        {members.length === 0 && <p className="text-zinc-700 text-xs text-center py-3">None</p>}
      </div>
    </div>
  );
}
