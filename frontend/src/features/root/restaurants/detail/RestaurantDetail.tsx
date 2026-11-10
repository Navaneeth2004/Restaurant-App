import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import Modal from 'components/ui/base/Modal';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { formatDateTime, timeAgo } from 'lib/format/local-time';
import type { RootConfig } from 'types/office/root';
import Badge, { statusTone } from '../../ui/Badge';
import { Section } from '../../ui/Layout';
import { useRestaurantDetail } from '../hooks/useRestaurantDetail';
import AccountSection from './AccountSection';
import ActionsSection from './ActionsSection';
import DevicesSection from './DevicesSection';
import FeatureOverrides from './FeatureOverrides';
import InfoSections from './InfoSections';

interface Props { id: string; config: RootConfig; onClose: () => void; onChanged: () => void; onViewTickets: (id: string) => void }

export default function RestaurantDetail({ id, config, onClose, onChanged, onViewTickets }: Props) {
  const a = useRestaurantDetail(id, config, onChanged);
  const d = a.data;
  const wide = 'max-w-4xl';

  if (!d || !a.form) {
    return <Modal title="Restaurant" className={wide} sheet showClose onClose={onClose}>{a.error ? <ErrorNotice error={a.error} onRetry={a.reload} fallback="Could not load the restaurant" /> : <PageSpinner />}</Modal>;
  }
  return (
    <Modal title={d.name} className={wide} sheet showClose onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap pr-10">
          <h3 className="font-bold text-white text-base mr-1">{d.name}</h3><Badge tone={statusTone(d.status)}>{d.status}</Badge><Badge tone="indigo">{d.plan}</Badge>
          <button type="button" className="font-mono text-[11px] text-zinc-500 hover:text-white" title="Copy id" onClick={() => void navigator.clipboard?.writeText(d.id)}>{d.id}</button>
          <span className="text-zinc-600 text-[11px]">created {formatDateTime(d.created_at)}</span>
        </div>
        {d.status === 'suspended' && <div role="status" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">Suspended {d.suspended_at ? timeAgo(d.suspended_at) : ''}{d.suspended_reason ? ` — ${d.suspended_reason}` : ''}</div>}
        <ErrorNotice error={a.error} onRetry={a.reload} fallback="Could not refresh" />
        <AccountSection data={d} config={config} form={a.form} onChange={a.setForm} problem={a.problem} busy={a.busy} onSave={() => void a.save()} />
        <FeatureOverrides detail={d} busy={a.busy} onSave={f => void a.saveFeatures(f)} />
        <InfoSections d={d} />
        <DevicesSection devices={d.devices} />
        <Section title="Tickets"><div className="flex items-center gap-3 text-xs"><span className="text-zinc-300">{d.tickets.open} open · {d.tickets.total} total</span><button type="button" className="text-brand-400 hover:underline" onClick={() => { onClose(); onViewTickets(d.id); }}>View tickets</button></div></Section>
        <ActionsSection d={d} a={a} onDeleted={onClose} />
      </div>
      {a.secret && (
        <Modal title="New owner password" className="max-w-sm" onClose={a.clearSecret} z={70}>
          <p className="text-zinc-400 text-xs mb-3">Shown once. Give it to the owner.</p>
          <p className="font-mono text-white text-lg text-center select-all">{a.secret}</p>
          <button type="button" className="btn btn-brand w-full mt-4" onClick={a.clearSecret}>Done</button>
        </Modal>
      )}
    </Modal>
  );
}