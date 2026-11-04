interface Props { enabled: boolean; onChange: () => void; label?: string }

export default function Toggle({ enabled, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${enabled ? 'bg-brand-500 border-brand-600' : 'bg-zinc-700 border-zinc-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}
