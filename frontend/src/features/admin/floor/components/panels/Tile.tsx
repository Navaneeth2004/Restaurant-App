interface Props { label: string; value: string; sub: string; color?: string }

export default function Tile({ label, value, sub, color }: Props) {
  return (
    <div className="fl-card flex flex-col gap-1">
      <p className="fl-label">{label}</p>
      <p className="fl-value text-[22px]" style={{ color: color ?? 'var(--fl-text)' }}>{value}</p>
      <p className="fl-sub">{sub}</p>
    </div>
  );
}
