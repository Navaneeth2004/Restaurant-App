'use strict';
/** The only place that rounds money or splits GST. */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Tax on `base` at `ratePct` percent. */
const taxOn = (base, ratePct) => round2((Number(base) * Number(ratePct)) / 100);

/** Intra-state GST split: half central, half state. */
function splitGst(taxable, ratePct) {
  const half = taxOn(taxable, ratePct / 2);
  return { cgst: half, sgst: half, tax: round2(half * 2) };
}

const withTax = (subtotal, ratePct) => round2(Number(subtotal) + taxOn(subtotal, ratePct));

module.exports = { round2, taxOn, splitGst, withTax };
