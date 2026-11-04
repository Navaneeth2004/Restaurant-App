import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useMediaQuery } from 'hooks/browser/useMediaQuery';
import { useSettings } from 'state/settings/useSettings';
import { useFloor } from '../hooks/useFloor';
import FloorDesktop from './FloorDesktop';
import FloorHeader from './FloorHeader';
import FloorMobile from './FloorMobile';

export default function FloorView() {
  const f = useFloor();
  const desktop = useMediaQuery('(min-width: 768px)');
  const sym = useSettings().currency_symbol || '₹';
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--fl-bg)' }}>
      <FloorHeader m={f.metrics} />
      {f.loading && <PageSpinner />}
      {f.error && f.tables.length === 0 ? <div className="p-4"><ErrorNotice error={f.error} onRetry={f.reload} fallback="Could not load the floor" /></div> : null}
      {desktop ? <FloorDesktop f={f} sym={sym} /> : <FloorMobile f={f} sym={sym} />}
    </div>
  );
}
