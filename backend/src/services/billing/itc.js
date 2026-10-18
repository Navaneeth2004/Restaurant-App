'use strict';
/** Input Tax Credit notes: restaurants filing at 5% cannot claim ITC; others must enter it from their own purchase records. */
const { round2 } = require('../../lib/money');

/** Effective rate over a period (the period may span a rate change). */
const effectiveRate = (sums, fallback) => (sums.taxable > 0 ? round2((sums.tax / sums.taxable) * 100) : fallback);

function gstr3bItc(displayRate) {
  if (displayRate === 5) {
    return {
      note: 'ITC not applicable — restaurants filing at 5% GST cannot claim input tax credit.',
      integrated_tax: 0, central_tax: 0, state_ut_tax: 0, cess: 0,
    };
  }
  return {
    note: `Your effective rate for this period is ${displayRate}%, which may be eligible for Input Tax Credit. This app doesn't track your purchase invoices, so enter your eligible ITC here from your own purchase records — do not enter ₹0 by default.`,
    integrated_tax: null, central_tax: null, state_ut_tax: null, cess: null,
  };
}

function gstr9Itc(displayRate) {
  const note = displayRate === 5
    ? 'ITC not applicable — restaurants filing at 5% GST (Notification 11/2017-CT(R)) cannot claim input tax credit. Enter ₹0 in all ITC fields (Part II, Table 6).'
    : `Effective rate for this year was ${displayRate}% — ITC may be claimable on your inputs. Enter eligible amounts from your purchase records in Table 6. This app does not track purchase invoices.`;
  return { note, itc: displayRate === 5 ? { integrated_tax: 0, central_tax: 0, state_ut_tax: 0, cess: 0 } : null };
}

module.exports = { effectiveRate, gstr3bItc, gstr9Itc };
