interface Props { label: string; value: string; /** Omit for "no data": the value is shown muted. */ color?: string }

/** One figure of the "Today's performance" block: a short single-line label over a clear value. */
export default function StatTile({ label, value, color }: Props) {
  return (
    <div className="rounded-xl px-3.5 py-3 min-w-0" style={{ background: 'var(--fl-card)', border: '1px solid var(--fl-border)' }}>
      <p className="fl-label text-[9px] whitespace-nowrap">{label}</p>
      <p className="fl-value text-[15px] mt-2 truncate" style={{ color: color ?? 'var(--fl-muted)' }}>{value}</p>
    </div>
  );
}
