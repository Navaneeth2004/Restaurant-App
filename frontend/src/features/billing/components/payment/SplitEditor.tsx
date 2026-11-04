import { SPLIT_METHODS } from 'config/payment';
import type { SplitEntry } from 'lib/reports/payment';

interface Props { splits: SplitEntry[]; sym: string; onChange: (next: SplitEntry[]) => void }

export default function SplitEditor({ splits, sym, onChange }: Props) {
  const update = (i: number, field: keyof SplitEntry, v: string): void => onChange(splits.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)));
  return (
    <div className="mb-3">
      <div className="bill-label">Split Details</div>
      {splits.map((s, i) => (
        <div key={i} className="flex gap-2 mb-2 items-center">
          <select aria-label="Method" className="bill-field" style={{ flex: 1.2 }} value={s.method} onChange={e => update(i, 'method', e.target.value)}>
            {SPLIT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }}>{sym}</span>
            <input aria-label="Amount" className="bill-field" style={{ paddingLeft: 24 }} type="number" min="0" step="0.01" placeholder="0.00" value={s.amount} onChange={e => update(i, 'amount', e.target.value)} />
          </div>
          {splits.length > 2 && <button type="button" aria-label="Remove method" onClick={() => onChange(splits.filter((_, idx) => idx !== i))} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', flexShrink: 0 }}>×</button>}
        </div>
      ))}
      <button type="button" className="bill-field" style={{ borderStyle: 'dashed', background: '#f9fafb', color: '#6b7280' }} onClick={() => onChange([...splits, { method: 'cash', amount: '' }])}>+ Add another method</button>
    </div>
  );
}
