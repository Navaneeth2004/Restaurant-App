import type { Category, MenuItem } from './catalog';

export interface KioskContext {
  kiosk_type: string; table_id: string; table_label: string; table_seats: number; table_status: string;
  is_parcel: boolean; session_id: string | null; restaurant_name: string; brand_color: string;
  currency_symbol: string; tax_percent: string; logo_url: string; bill_footer: string; address: string; phone: string;
}
export interface KioskMenu { categories: Category[]; items: MenuItem[] }
