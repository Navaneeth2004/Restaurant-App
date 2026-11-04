import { formatDate } from 'lib/format/local-time';
import PillTabs from './PillTabs';

interface Props { title: string; tabs?: ReadonlyArray<{ key: string; label: string }>; active?: string; onSelect?: (key: string) => void }

/** Header of the Reports / Export / Backup screens: title and today's date on the left, an optional pill switcher on the right. */
export default function ViewHeader({ title, tabs, active, onSelect }: Props) {
  return (
    <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
      <div className="flex items-center gap-3 flex-shrink-0">
        <h2 className="font-bold text-white text-sm hidden sm:block">{title}</h2>
        <span className="text-zinc-500 text-xs hidden sm:block">{formatDate(new Date().toISOString(), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      {tabs && active !== undefined && onSelect && <div className="sm:ml-auto self-start"><PillTabs tabs={tabs} active={active} onSelect={onSelect} label={`${title} sections`} /></div>}
    </div>
  );
}
