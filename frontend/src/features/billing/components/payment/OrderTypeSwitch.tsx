import type { OrderType } from 'types/restaurant/orders';

export default function OrderTypeSwitch({ value, onChange }: { value: OrderType; onChange: (t: OrderType) => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="bill-label">Order Type</div>
      <div className="bill-switch" role="radiogroup" aria-label="Order type">
        {(['dine_in', 'parcel'] as const).map(t => (
          <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => onChange(t)}>{t === 'dine_in' ? 'Dine In' : 'Parcel'}</button>
        ))}
      </div>
    </div>
  );
}
