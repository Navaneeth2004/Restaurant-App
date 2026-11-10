interface Props { onClick: () => void; loading?: boolean; label?: string }

/** Small square icon button that reloads a list. The icon spins while loading. */
export default function RefreshButton({ onClick, loading = false, label = 'Refresh' }: Props) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={loading}
      className="flex-shrink-0 w-9 h-9 rounded-lg border border-surface-border bg-surface-raised text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-60 transition-colors">
      <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    </button>
  );
}
