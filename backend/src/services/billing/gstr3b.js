'use strict';
/** GSTR-3B: monthly summary return. */
const { round2 } = require('../../lib/money');
const { sumBills } = require('./bills');
const { effectiveRate, gstr3bItc } = require('./itc');

function build(d) {
  const all = sumBills(d.bills);
  const b2b = sumBills(d.bills.filter(b => b.isB2B));
  const rate = effectiveRate(all, d.currentRate);
  return {
    period: { from: d.dateFrom, to: d.dateTo },
    gstin: d.profile.gstin, legal_name: d.profile.legalName, tax_rate: rate,
    outward_taxable: {
      total_taxable_value: all.taxable, integrated_tax: 0, central_tax: all.cgst, state_ut_tax: all.sgst,
      cess: 0, total_tax: all.tax, total_incl_tax: all.total,
    },
    intrastate_b2c: {
      taxable_value: round2(all.taxable - b2b.taxable), central_tax: round2(all.cgst - b2b.cgst), state_ut_tax: round2(all.sgst - b2b.sgst),
    },
    intrastate_b2b: { taxable_value: b2b.taxable, central_tax: b2b.cgst, state_ut_tax: b2b.sgst, invoice_count: b2b.count },
    itc_claimed: gstr3bItc(rate),
    tax_paid: { integrated_tax: 0, central_tax: all.cgst, state_ut_tax: all.sgst, cess: 0 },
    order_count: all.count,
  };
}

module.exports = { build };
