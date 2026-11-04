import { errorMessage } from 'api/errors';
import Icon from '../base/Icon';

interface Props { error: unknown; onRetry?: () => void; fallback?: string }

/** Inline error with the server's text and an optional retry. Renders nothing when there is no error. */
export default function ErrorNotice({ error, onRetry, fallback }: Props) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
      <Icon name="alert" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span className="flex-1">{errorMessage(error, fallback)}</span>
      {onRetry && <button type="button" className="font-semibold underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}
