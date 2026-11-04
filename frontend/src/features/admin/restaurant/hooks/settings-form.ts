import { LIMITS } from 'config/constants';
import { clamp } from 'lib/input/input';
import { isHexColor } from 'lib/browser/color';
import type { Settings, SettingsPatch } from 'types/core/settings';

export interface FormShape {
  restaurant_name: string; address: string; phone: string; bill_footer: string;
  tax_percent: string; currency_symbol: string; kitchen_overdue_mins: string; brand_color: string;
  gstin: string; legal_name: string; state_name: string; sac_code: string; b2b_enabled: string;
}
export type FormKey = keyof FormShape;

export const fromSettings = (s: Settings): FormShape => ({
  restaurant_name: s.restaurant_name ?? '', address: s.address ?? '', phone: s.phone ?? '', bill_footer: s.bill_footer ?? '',
  tax_percent: s.tax_percent ?? '5', currency_symbol: s.currency_symbol ?? '₹', kitchen_overdue_mins: s.kitchen_overdue_mins ?? '20',
  brand_color: s.brand_color ?? '', gstin: s.gstin ?? '', legal_name: s.legal_name ?? '', state_name: s.state_name || 'Kerala',
  sac_code: s.sac_code || '9963', b2b_enabled: s.b2b_enabled || 'false',
});

/**
 * Keyboard-safe numeric field: HTML min/max only affect the spinner, so a typed "1000000" must be clamped here.
 * Returns the text to store, or null to ignore the keystroke (not a number).
 */
export function clampField(raw: string, min: number, max: number): string | null {
  if (raw === '') return '';
  const n = Number.parseFloat(raw);
  return Number.isNaN(n) ? null : String(clamp(n, min, max));
}

const inRange = (raw: string, min: number, max: number): boolean => { const n = Number(raw); return raw.trim() !== '' && Number.isFinite(n) && n >= min && n <= max; };

/** null when the form may be saved, else the message to show. */
export function validateSettings(f: FormShape): string | null {
  if (!inRange(f.tax_percent, LIMITS.taxMin, LIMITS.taxMax)) return `Tax % must be between ${LIMITS.taxMin} and ${LIMITS.taxMax}.`;
  if (!inRange(f.kitchen_overdue_mins, LIMITS.overdueMin, LIMITS.overdueMax)) return `Kitchen overdue minutes must be between ${LIMITS.overdueMin} and ${LIMITS.overdueMax}.`;
  if (!isHexColor(f.brand_color)) return 'Brand colour must look like #f97316.';
  if (f.gstin.trim() !== '' && f.gstin.trim().length !== LIMITS.gstin) return `GSTIN must be exactly ${LIMITS.gstin} characters (or leave it empty).`;
  if (f.currency_symbol.trim() === '') return 'Enter a currency symbol.';
  return null;
}

export const toPatch = (f: FormShape): SettingsPatch => ({
  restaurant_name: f.restaurant_name.trim(), address: f.address.trim(), phone: f.phone.trim(), bill_footer: f.bill_footer.trim(),
  tax_percent: f.tax_percent.trim(), currency_symbol: f.currency_symbol.trim(), kitchen_overdue_mins: f.kitchen_overdue_mins.trim(),
  brand_color: f.brand_color.trim(), gstin: f.gstin.trim().toUpperCase(), legal_name: f.legal_name.trim(), state_name: f.state_name,
  sac_code: f.sac_code.trim(), b2b_enabled: f.b2b_enabled,
});
