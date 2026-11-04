import { ReactNode } from 'react';
import { formatDayLabel } from 'lib/format/local-time';
import type { RevenueDay } from 'types/office/reports';

interface Props {
  title: string; subtitle: string; headline: ReactNode; empty: boolean;
  days: ReadonlyArray<RevenueDay>; value: (d: RevenueDay) => number; hint: (d: RevenueDay) => string;
  color: string; pastColor: string; height: number; todayClass: string;
}

/** One bar per calendar day (days without orders are shown as empty slots). The last bar is today. */
export default function DailyBars({ title, subtitle, headline, empty, days, value, hint, color, pastColor, height, todayClass }: Props) {
  const max = Math.max(...days.map(value), 0.01);
  const bar = height - 4;
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div><h3 className="font-bold text-white text-sm">{title}</h3><p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p></div>
        <div className="text-right ml-4 flex-shrink-0">{headline}</div>
      </div>
      {empty ? (
        <div className="flex items-center justify-center text-zinc-700 text-sm" style={{ height }}>No data yet</div>
      ) : (
        <>
          <div role="img" aria-label={`${title}, ${days.length} days`} className="flex items-end gap-px" style={{ height }}>
            {days.map((d, i) => {
              const h = Math.max(2, Math.round((value(d) / max) * bar));
              return (
                <div key={d.day} className="flex-1 flex items-end" style={{ height: bar }} title={`${formatDayLabel(d.day)}: ${hint(d)}`}>
                  <div className="w-full rounded-t-sm" style={{ height: h, backgroundColor: i === days.length - 1 ? color : pastColor }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
            <span>{formatDayLabel(days[0].day)}</span><span>{formatDayLabel(days[Math.floor(days.length / 2)].day)}</span>
            <span className={`font-bold ${todayClass}`}>Today</span>
          </div>
        </>
      )}
    </div>
  );
}
