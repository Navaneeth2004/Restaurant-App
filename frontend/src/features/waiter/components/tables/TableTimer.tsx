import Icon from 'components/ui/base/Icon';
import { elapsedLabel, minutesSince } from 'lib/format/local-time';

interface Props { since: string; nowMs: number }

function tone(mins: number): { text: string; bg: string; border: string; dot: string } {
  if (mins < 30) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400' };
  if (mins < 60) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-400' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', dot: 'bg-red-400' };
}

/** Compact "how long has this table been occupied" pill: green, then amber, then red. */
export default function TableTimer({ since, nowMs }: Props) {
  const mins = minutesSince(since, nowMs);
  const c = tone(mins);
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full border ${c.text} ${c.bg} ${c.border}`}>
      <Icon name="clock" className="w-2.5 h-2.5 flex-shrink-0" />
      {elapsedLabel(mins)}
      {mins >= 60 && <span className={`w-1 h-1 rounded-full flex-shrink-0 animate-pulse ${c.dot}`} />}
    </span>
  );
}
