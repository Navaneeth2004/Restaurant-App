import Icon, { IconName } from '../base/Icon';

interface Props { title: string; hint?: string; icon?: IconName }

export default function EmptyState({ title, hint, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-600 text-center">
      {icon && (
        <div className="w-14 h-14 rounded-2xl border border-surface-border bg-surface-card flex items-center justify-center mb-4 text-zinc-600">
          <Icon name={icon} className="w-6 h-6" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}
