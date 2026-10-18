'use strict';
/** GSTR-9: annual return summary for an Indian financial year (April–March). */
const { round2 } = require('../../lib/money');
const { sumBills } = require('./bills');
const { loadRange, itemQuantity } = require('./gst-data');
const { effectiveRate, gstr9Itc } = require('./itc');

/** "2025-26" -> 2025 (falls back to the current financial year). */
function financialYearStart(fyParam) {
  const now = new Date();
  const current = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const m = String(fyParam || '').match(/^(\d{4})-\d{2}$/);
  return m ? parseInt(m[1], 10) : current;
}

function monthlyBreakdown(bills) {
  const map = {};
  for (const b of bills) {
    const key = b.localDay.slice(0, 7);
    const m = map[key] || (map[key] = { month: key, bills: [], orders: 0 });
    m.bills.push(b);
    m.orders += b.rows.length;
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map((m) => {
    const s = sumBills(m.bills);
    return { month: m.month, taxable: s.taxable, cgst: s.cgst, sgst: s.sgst, tax: s.tax, orders: m.orders, sessions: s.count };
  });
}

function build({ fy, offset }) {
  const start = financialYearStart(fy);
  const label = `${start}-${String(start + 1).slice(2)}`;
  const d = loadRange({ from: `${start}-04-01`, to: `${start + 1}-03-31`, offset });
  const b2b = d.bills.filter(b => b.isB2B), b2c = d.bills.filter(b => !b.isB2B);
  const all = sumBills(d.bills), sb2b = sumBills(b2b), sb2c = sumBills(b2c);
  const parcel = sumBills(d.bills.filter(b => b.orderType === 'parcel'));
  const rate = effectiveRate(all, d.currentRate);
  const itc = gstr9Itc(rate);

  return {
    fy: label, period: { from: d.dateFrom, to: d.dateTo },
    gstin: d.profile.gstin, legal_name: d.profile.legalName, state_name: d.profile.stateName,
    sac_code: d.profile.sacCode, tax_rate: rate,
    order_count: d.rows.length, session_count: all.count,
    outward: {
      b2b_taxable: sb2b.taxable, b2b_cgst: sb2b.cgst, b2b_sgst: sb2b.sgst,
      b2c_taxable: sb2c.taxable, b2c_cgst: sb2c.cgst, b2c_sgst: sb2c.sgst,
      total_taxable: all.taxable, total_cgst: all.cgst, total_sgst: all.sgst, total_igst: 0, total_cess: 0,
      total_incl_tax: all.total,
      dine_in_taxable: round2(all.taxable - parcel.taxable), parcel_taxable: parcel.taxable,
    },
    tax_paid: { integrated_tax: 0, central_tax: all.cgst, state_ut_tax: all.sgst, cess: 0, total: all.tax },
    itc_note: itc.note, itc: itc.itc,
    hsn_summary: [{
      num: 1, hsn_sc: d.profile.sacCode, desc: 'Restaurant Services', uqc: 'OTH', qty: itemQuantity(d.rows),
      taxable: all.taxable, igst: 0, cgst: all.cgst, sgst: all.sgst, cess: 0,
    }],
    monthly_breakdown: monthlyBreakdown(d.bills),
  };
}

module.exports = { build };
