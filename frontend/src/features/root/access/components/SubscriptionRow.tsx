import type { Subscription } from 'types/office/root';
import Badge from '../../ui/Badge';

interface Props { sub: Subscription; totalFeatures: number; onEdit: () => void; onCopy: () => void; onDelete: () => void }

export default function SubscriptionRow({ sub, totalFeatures, onEdit, onCopy, onDelete }: Props) {
  const off = sub.disabled.length;
  return (
    <li className="px-4 py-3 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-sm font-semibold">{sub.name}</span>
          <span className="font-mono text-[10px] text-zinc-500">{sub.slug}</span>
          {off === 0 ? <Badge tone="green">everything on</Badge> : <Badge tone="amber">{`${off} of ${totalFeatures} off`}</Badge>}
        </div>
        <p className="text-zinc-500 text-xs mt-0.5">{sub.restaurants} restaurant{sub.restaurants === 1 ? '' : 's'}{sub.description ? ` · ${sub.description}` : ''}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-shrink-0">
        <button type="button" className="btn btn-sm" onClick={onEdit}>Edit</button>
        <button type="button" className="btn btn-sm" onClick={onCopy}>Duplicate</button>
        <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </li>
  );
}