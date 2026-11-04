import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import type { RestaurantDetail } from 'types/office/root';
import { Section } from '../../ui/Layout';
import type { useRestaurantDetail } from '../hooks/useRestaurantDetail';
import { DeleteDialog, PasswordDialog, SuspendDialog } from './ActionDialogs';

type Actions = ReturnType<typeof useRestaurantDetail>;
type Dialog = 'suspend' | 'password' | 'delete' | null;

export default function ActionsSection({ d, a, onDeleted }: { d: RestaurantDetail; a: Actions; onDeleted: () => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const { ask, dialog: confirm } = useConfirmAction();
  const close = (): void => setDialog(null);

  return (
    <Section title="Actions">
      <div className="flex flex-wrap gap-2">
        {d.status === 'active'
          ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDialog('suspend')}>Suspend</button>
          : <button type="button" className="btn btn-sm btn-success" disabled={a.busy} onClick={() => void a.activate()}>Activate</button>}
        <button type="button" className="btn btn-sm" disabled={a.busy} onClick={() => ask({ title: 'Revoke all devices?', message: 'Every device of this restaurant is disconnected. They must link again.', confirmLabel: 'Revoke all', danger: true, action: async () => { await a.revokeAll(); } })}>Revoke all devices</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('password')}>Reset owner password</button>
        <button type="button" className="btn btn-sm btn-danger ml-auto" onClick={() => setDialog('delete')}>Delete restaurant…</button>
      </div>
      {confirm && <ConfirmDialog {...confirm} />}
      {dialog === 'suspend' && <SuspendDialog onCancel={close} onDone={r => { close(); void a.suspend(r); }} />}
      {dialog === 'password' && <PasswordDialog onCancel={close} onDone={pw => { close(); void a.resetPassword(pw); }} />}
      {dialog === 'delete' && <DeleteDialog name={d.name} onCancel={close} onDone={async (n, pw) => { close(); if (await a.remove(n, pw)) onDeleted(); }} />}
    </Section>
  );
}
