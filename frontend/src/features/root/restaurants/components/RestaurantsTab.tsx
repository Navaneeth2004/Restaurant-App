import { useState } from 'react';
import ChoicePills from 'components/ui/base/ChoicePills';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useRestaurants } from '../hooks/useRestaurants';
import RestaurantDetail from '../detail/RestaurantDetail';
import CreateRestaurantModal from './CreateRestaurantModal';
import RestaurantTable from './RestaurantTable';

interface Props { openId: string | null; onOpenId: (id: string | null) => void; onViewTickets: (restaurantId: string) => void }

const STATUSES = [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }];

export default function RestaurantsTab({ openId, onOpenId, onViewTickets }: Props) {
  const r = useRestaurants();
  const [creating, setCreating] = useState(false);
  const { reload } = r.list;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input aria-label="Search restaurants" className="input w-full sm:w-64" placeholder="Search name, id or phone…" value={r.q} onChange={e => r.setQ(e.target.value)} />
        <ChoicePills label="Status filter" options={STATUSES} value={r.status} onChange={r.setStatus} />
        <span className="text-zinc-500 text-xs">{r.rows.length} of {r.list.data?.length ?? 0}</span>
        <button type="button" className="btn btn-brand btn-sm ml-auto" onClick={() => setCreating(true)} disabled={!r.config}>+ New restaurant</button>
      </div>
      <ErrorNotice error={r.list.error ?? r.configError} onRetry={reload} fallback="Could not load the restaurants" />
      {r.list.data ? <RestaurantTable rows={r.rows} onOpen={onOpenId} /> : !r.list.error && <PageSpinner />}
      {creating && r.config && <CreateRestaurantModal config={r.config} onClose={() => setCreating(false)} onCreated={reload} />}
      {openId && r.config && <RestaurantDetail id={openId} config={r.config} onClose={() => onOpenId(null)} onChanged={reload} onViewTickets={onViewTickets} />}
    </div>
  );
}
