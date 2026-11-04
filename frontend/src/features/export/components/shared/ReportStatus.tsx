import { ReactNode } from 'react';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';

interface Props { error: unknown; onRetry: () => void; failure: string; loading: boolean; hasData: boolean; children: ReactNode }

/** Error + first-load spinner + "updating" dim around a report's results, so old figures never look current. */
export default function ReportStatus({ error, onRetry, failure, loading, hasData, children }: Props) {
  return (
    <>
      <ErrorNotice error={error} onRetry={onRetry} fallback={failure} />
      {!hasData && loading && <PageSpinner />}
      {hasData && <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>{children}</div>}
    </>
  );
}
