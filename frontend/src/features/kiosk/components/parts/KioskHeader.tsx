import { API_ORIGIN } from 'config/env';
import type { KioskContext } from 'types/restaurant/kiosk';

export default function KioskHeader({ ctx }: { ctx: KioskContext }) {
  return (
    <header className="bg-brand-500 px-4 py-3 flex items-center gap-3 flex-shrink-0">
      {ctx.logo_url && <img src={`${API_ORIGIN}${ctx.logo_url}`} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-white text-[15px] font-bold leading-tight truncate">{ctx.restaurant_name}</p>
        <p className="text-white/70 text-xs mt-0.5">{ctx.is_parcel ? 'Parcel / Takeaway' : `${ctx.table_label} • Dine in`}</p>
      </div>
    </header>
  );
}
