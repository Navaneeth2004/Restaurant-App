import { FormEvent, useState } from 'react';
import Modal from 'components/ui/base/Modal';
import Spinner from 'components/ui/feedback/Spinner';
import type { FeatureDef, SubscriptionInput } from 'types/office/root';
import { Field } from '../../ui/Layout';
import { formProblem, SubForm, toInput } from '../hooks/subscription-form';
import FeatureGrid from './FeatureGrid';

interface Props {
  title: string; initial: SubForm; features: ReadonlyArray<FeatureDef>; limitKeys: ReadonlyArray<{ key: string; label: string }>;
  busy: boolean; onSave: (input: SubscriptionInput) => void; onClose: () => void;
}

/** Create or edit a subscription: its name, its limits, and which features its restaurants may use. */
export default function SubscriptionEditor({ title, initial, features, limitKeys, busy, onSave, onClose }: Props) {
  const [form, setForm] = useState<SubForm>(initial);
  const [shown, setShown] = useState(false);
  const problem = formProblem(form);
  const set = (patch: Partial<SubForm>): void => setForm(f => ({ ...f, ...patch }));

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setShown(true);
    if (!problem) onSave(toInput(form));
  };

  return (
    <Modal title={title} className="max-w-2xl" sheet showClose onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <h3 className="font-bold text-white text-base pr-10">{title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name" htmlFor="sub-name"><input id="sub-name" className="input" maxLength={60} value={form.name} onChange={e => set({ name: e.target.value })} autoFocus /></Field>
          <Field label="Description" htmlFor="sub-desc"><input id="sub-desc" className="input" maxLength={300} value={form.description} onChange={e => set({ description: e.target.value })} /></Field>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Limits (blank = unlimited)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {limitKeys.map(k => (
              <Field key={k.key} label={k.label} htmlFor={`sub-${k.key}`}>
                <input id={`sub-${k.key}`} className="input font-mono" type="number" min={0} value={form.limits[k.key] ?? ''} onChange={e => set({ limits: { ...form.limits, [k.key]: e.target.value } })} />
              </Field>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">What these restaurants can use</p>
          <p className="text-zinc-600 text-xs mb-3">Switched-off screens and features are hidden for them and refused by the server. Features added later start switched on.</p>
          <FeatureGrid features={features} disabled={form.disabled} onChange={disabled => set({ disabled })} />
        </div>
        {shown && problem && <p role="alert" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{problem}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" className="btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-brand flex-1" disabled={busy}>{busy ? <><Spinner />Saving…</> : 'Save subscription'}</button>
        </div>
      </form>
    </Modal>
  );
}