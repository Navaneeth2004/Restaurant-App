export interface Settings {
  restaurant_name: string;
  address: string;
  phone: string;
  bill_footer: string;
  tax_percent: string;
  brand_color: string;
  currency_symbol: string;
  logo_url?: string;
  kitchen_overdue_mins?: string;
  gstin?: string;
  legal_name?: string;
  state_name?: string;
  sac_code?: string;
  b2b_enabled?: string;
  admin_lock_config?: string;
}
export type SettingsPatch = Partial<Omit<Settings, 'admin_lock_config'>>;
