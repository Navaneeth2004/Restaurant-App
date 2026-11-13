'use strict';
/** The only place that rounds money or splits GST. */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Tax on `base` at `ratePct` percent. */
const taxOn = (base, ratePct) => round2((Number(base) * Number(ratePct)) / 100);

/**
 * Intra-state GST split. The tax is computed ONCE on the whole bill (exactly what the customer is charged),
 * CGST is half of it and SGST the remainder, so cgst + sgst always equals the tax on the bill.
 */
function splitGst(taxable, ratePct) {
  const tax = taxOn(taxable, ratePct);
  const cgst = round2(tax / 2);
  return { cgst, sgst: round2(tax - cgst), tax };
}

const withTax = (subtotal, ratePct) => round2(Number(subtotal) + taxOn(subtotal, ratePct));

module.exports = { round2, taxOn, splitGst, withTax };
