'use strict';
/**
 * Phone numbers are stored as digits with the country code (e.g. 919876543210).
 * Older accounts were stored exactly as typed (9876543210), so lookups use phoneVariants().
 */
function normalizePhone(value, countryCode = '91') {
  const digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.length === 10 ? countryCode + digits : digits;
}

/** Every form this number may be stored in (canonical first). Empty array = invalid number. */
function phoneVariants(value, countryCode = '91') {
  const canonical = normalizePhone(value, countryCode);
  if (!canonical) return [];
  const out = [canonical];
  if (canonical.startsWith(countryCode) && canonical.length === countryCode.length + 10) {
    out.push(canonical.slice(countryCode.length));
  }
  return out;
}

module.exports = { normalizePhone, phoneVariants };
