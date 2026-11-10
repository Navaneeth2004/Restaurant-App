import { useState } from 'react';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useRestaurants } from '../hooks/useRestaurants';
import RestaurantDetail from '../detail/RestaurantDetail';
import CreateRestaurantModal from './CreateRestaurantModal';
import RestaurantTable from './RestaurantTable';

interface Props { openId: string | null; onOpenId: (id: string | null) => void; onViewTickets: (restaurantId: string) => void }

export default function RestaurantsTab({ openId, onOpenId, onViewTickets }: Props) {
  const r = useRestaurants();
  const [creating, setCreating] = useState(false);
  const { reload } = r.list;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input aria-label="Search restaurants" className="input sm:max-w-xs sm:flex-1" placeholder="Search name, id or phone…" value={r.q} onChange={e => r.setQ(e.target.value)} />
        <select aria-label="Status filter" className="input w-auto" value={r.status} onChange={e => r.setStatus(e.target.value)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
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