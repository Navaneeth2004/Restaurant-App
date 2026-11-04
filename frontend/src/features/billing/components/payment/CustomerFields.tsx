import { LIMITS } from 'config/constants';
import type { PaymentForm } from '../../payment-input';

interface Props { form: PaymentForm; b2b: boolean; onChange: <K extends 'customerName' | 'customerPhone' | 'customerGstin'>(k: K, v: string) => void }

export default function CustomerFields({ form, b2b, onChange }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="bill-label">Customer <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#d1d5db' }}>— optional</span></div>
      <div className="flex gap-2" style={{ marginBottom: b2b ? 8 : 0 }}>
        <input aria-label="Customer name" className="bill-field" placeholder="Name" maxLength={60} value={form.customerName} onChange={e => onChange('customerName', e.target.value)} />
        <input aria-label="Customer phone" className="bill-field" type="tel" placeholder="Phone" maxLength={20} value={form.customerPhone} onChange={e => onChange('customerPhone', e.target.value)} />
      </div>
      {b2b && (
        <>
          <input aria-label="Customer GSTIN" className="bill-field" style={{ fontFamily: 'ui-monospace,monospace', letterSpacing: '.05em', textTransform: 'uppercase', borderColor: form.customerGstin ? '#6366f1' : undefined }}
            placeholder="Customer GSTIN (B2B invoice)" maxLength={LIMITS.gstin} value={form.customerGstin} onChange={e => onChange('customerGstin', e.target.value.toUpperCase())} />
          {form.customerGstin && <div style={{ fontSize: 10, color: '#6366f1', marginTop: 4 }}>B2B tax invoice — will appear in GSTR-1 B2B section</div>}
        </>
      )}
    </div>
  );
}
