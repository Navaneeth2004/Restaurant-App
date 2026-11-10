import { formatDateTime } from 'lib/format/local-time';
import type { AuditRow as Row } from 'types/office/root';
import Badge, { Tone } from '../ui/Badge';

const tone = (action: string): Tone => (/failed|delete|remove|reset|suspend|revoke|unlink/.test(action) ? 'red' : action.startsWith('app.') ? 'indigo' : 'grey');

/** The detail column holds JSON: show it as "key: value · key: value". */
function describe(raw: string | null): string {
  if (!raw) return '';
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === 'object' && v !== null) {
      return Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`).join(' · ');
    }
  } catch { /* plain text: show it as it is */ }
  return raw;
}

export default function AuditRow({ entry: a }: { entry: Row }) {
  const app = a.action.startsWith('app.');
  const text = describe(a.detail);
  return (
    <li className="px-4 py-3 border-b border-surface-border/60 last:border-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone={tone(a.action)}>{app ? 'restaurant' : 'root'}</Badge>
        <span className="text-white font-mono text-xs break-all">{a.action}</span>
        <span className="text-zinc-500 text-[11px] sm:ml-auto whitespace-nowrap">{formatDateTime(a.at)}</span>
      </div>
      {text && <p className="text-zinc-300 text-xs mt-1 break-words">{text}</p>}
      <p className="text-zinc-600 text-[10px] font-mono mt-0.5 break-all">
        {[a.owner_phone, a.target && `target ${a.target}`, a.ip].filter(Boolean).join(' · ') || '—'}
      </p>
    </li>
  );
}