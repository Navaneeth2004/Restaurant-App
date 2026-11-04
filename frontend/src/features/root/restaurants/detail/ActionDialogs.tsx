import { useState } from 'react';
import Modal from 'components/ui/base/Modal';
import { Field } from '../../ui/Layout';

const Buttons = ({ onCancel, onOk, label, disabled, danger }: { onCancel: () => void; onOk: () => void; label: string; disabled?: boolean; danger?: boolean }) => (
  <div className="flex gap-2 mt-4"><button type="button" className="btn flex-1" onClick={onCancel}>Cancel</button><button type="button" className={`btn flex-1 ${danger ? 'btn-danger' : 'btn-brand'}`} disabled={disabled} onClick={onOk}>{label}</button></div>
);

export function SuspendDialog({ onCancel, onDone }: { onCancel: () => void; onDone: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Suspend restaurant" onClose={onCancel} z={60}>
      <p className="text-zinc-400 text-xs mb-3">All devices are disconnected immediately and cannot get back in until you activate it again.</p>
      <Field label="Reason (shown to them)" htmlFor="sus-reason"><input id="sus-reason" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Payment pending" autoFocus /></Field>
      <Buttons onCancel={onCancel} onOk={() => onDone(reason)} label="Suspend" danger />
    </Modal>
  );
}

export function PasswordDialog({ onCancel, onDone }: { onCancel: () => void; onDone: (password: string) => void }) {
  const [pw, setPw] = useState('');
  return (
    <Modal title="Reset owner password" onClose={onCancel} z={60}>
      <Field label="New password" htmlFor="pw-new" hint="Leave empty to generate one (it will be shown once)."><input id="pw-new" className="input" value={pw} onChange={e => setPw(e.target.value)} autoFocus /></Field>
      <Buttons onCancel={onCancel} onOk={() => onDone(pw)} label="Reset" />
    </Modal>
  );
}

export function DeleteDialog({ name, onCancel, onDone }: { name: string; onCancel: () => void; onDone: (confirmName: string, password: string) => void }) {
  const [typed, setTyped] = useState('');
  const [pw, setPw] = useState('');
  return (
    <Modal title="Delete restaurant permanently" onClose={onCancel} z={60}>
      <p className="text-red-400 text-xs mb-3">This deletes all orders, menu, staff and photos of “{name}”. It cannot be undone. Take a backup first if unsure.</p>
      <div className="space-y-3">
        <Field label={`Type the name to confirm: ${name}`} htmlFor="del-name"><input id="del-name" className="input" value={typed} onChange={e => setTyped(e.target.value)} autoFocus /></Field>
        <Field label="Your root password" htmlFor="del-pw"><input id="del-pw" className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
      </div>
      <Buttons onCancel={onCancel} onOk={() => onDone(typed, pw)} label="Delete forever" danger disabled={typed !== name || !pw} />
    </Modal>
  );
}
