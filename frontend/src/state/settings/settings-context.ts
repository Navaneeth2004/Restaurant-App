import { createContext } from 'react';
import { DEFAULT_BRAND } from 'lib/browser/color';
import type { Settings } from 'types/core/settings';

export const DEFAULT_SETTINGS: Settings = {
  restaurant_name: '',
  brand_color: DEFAULT_BRAND,
  currency_symbol: '₹',
  tax_percent: '5',
  address: '',
  phone: '',
  bill_footer: 'Thank you for dining with us!',
  kitchen_overdue_mins: '20',
};

export interface SettingsValue { settings: Settings; refresh: () => void }
export const SettingsContext = createContext<SettingsValue>({ settings: DEFAULT_SETTINGS, refresh: () => undefined });
