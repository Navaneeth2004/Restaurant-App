interface Props { className?: string }

export default function Spinner({ className = 'w-3.5 h-3.5 border-white/40 border-t-white' }: Props) {
  return <span role="status" aria-label="Loading" className={`inline-block flex-shrink-0 rounded-full border-2 animate-spin ${className}`} />;
}
