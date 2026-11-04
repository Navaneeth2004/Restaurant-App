interface Props { title: string; hint?: string }

export default function EmptyState({ title, hint }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-600 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}
