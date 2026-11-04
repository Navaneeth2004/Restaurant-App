import Spinner from 'components/ui/feedback/Spinner';

export function BackLink({ onBack }: { onBack: () => void }) {
  return <button type="button" onClick={onBack} className="text-xs text-zinc-500 hover:text-white mb-4">← Back</button>;
}

export function SubmitButton({ busy, label, disabled = false }: { busy: boolean; label: string; disabled?: boolean }) {
  return (
    <button type="submit" className="btn btn-brand w-full py-3" disabled={busy || disabled}>
      {busy ? <Spinner /> : label}
    </button>
  );
}
