'use strict';
/** GSTR-1: outward supplies. B2B = bills with a customer GSTIN, B2CS = everything else (aggregated). */
const { round2 } = require('../../lib/money');
const { fail } = require('../../lib/http');
const { localDMY } = require('../../lib/local-time');
const { sumBills, invoiceLabel } = require('./bills');
const { itemQuantity } = require('./gst-data');

/** MMYYYY of the END of the period (a quarterly filer files under the quarter's last month). */
const returnPeriod = (date) => `${date.slice(5, 7)}${date.slice(0, 4)}`;
const split = (bills) => ({ b2b: bills.filter(b => b.isB2B), b2c: bills.filter(b => !b.isB2B) });

function b2csRows(bills, stateCode) {
  const map = {};
  for (const b of bills) {
    const key = `${b.rate}|${stateCode}`;
    if (!map[key]) map[key] = { sply_ty: 'INTRA', typ: 'OE', pos: stateCode, rt: b.rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    map[key].txval = round2(map[key].txval + b.taxable);
    map[key].camt = round2(map[key].camt + b.cgst);
    map[key].samt = round2(map[key].samt + b.sgst);
  }
  return Object.values(map);
}

function b2bRows(bills, d) {
  const byGstin = {};
  for (const b of bills) {
    if (!byGstin[b.gstin]) byGstin[b.gstin] = { ctin: b.gstin, inv: [] };
    byGstin[b.gstin].inv.push({
      inum: b.invoiceLabel, idt: localDMY(b.closedAt, d.offset), val: b.total,
      pos: d.profile.stateCode, rchrg: 'N', inv_typ: 'R',
      itms: [{ num: 1, itm_det: {
        ty: 'G', hsn_sc: d.profile.sacCode, txval: b.taxable, irt: b.rate, iamt: 0,
        crt: b.rate / 2, camt: b.cgst, srt: b.rate / 2, samt: b.sgst, csrt: 0, csamt: 0 } }],
    });
  }
  return Object.values(byGstin);
}

/** Series actually issued in the period: first/last invoice number, how many numbers are missing (deleted/cancelled). */
function documentsIssued(bills) {
  const nums = bills.map(b => b.invoiceNo).filter(n => n != null);
  if (!nums.length) return [];
  const lo = nums.reduce((a, n) => Math.min(a, n), nums[0]);
  const hi = nums.reduce((a, n) => Math.max(a, n), nums[0]);
  const total = hi - lo + 1;
  return [{ num: 1, from: invoiceLabel(lo), to: invoiceLabel(hi), totnum: total, cancel: total - nums.length, net_issue: nums.length }];
}

function preview(d) {
  const { b2b, b2c } = split(d.bills);
  const all = sumBills(d.bills), sb2b = sumBills(b2b), sb2c = sumBills(b2c);
  const qty = itemQuantity(d.rows);
  const fields = (s) => ({ invoice_count: s.count, taxable_value: s.taxable, central_tax: s.cgst, state_ut_tax: s.sgst });
  return {
    period: { from: d.dateFrom, to: d.dateTo }, return_period: returnPeriod(d.dateTo),
    gstin: d.profile.gstin, legal_name: d.profile.legalName, state_name: d.profile.stateName,
    state_code: d.profile.stateCode, sac_code: d.profile.sacCode, tax_rate: d.currentRate,
    order_count: all.count, item_qty: qty,
    b2cs: fields(sb2c),
    b2b: { gstin_count: new Set(b2b.map(b => b.gstin)).size, ...fields(sb2b) },
    totals: { taxable_value: all.taxable, central_tax: all.cgst, state_ut_tax: all.sgst, total_tax: all.tax, total_incl_tax: all.total },
    hsn_summary: [{
      hsn_sc: d.profile.sacCode, desc: 'Restaurant Services', uqc: 'OTH', qty,
      taxable: all.taxable, central_tax: all.cgst, state_ut_tax: all.sgst,
    }],
    doc_issued: all.count,
  };
}

function portalJson(d) {
  if (!d.profile.stateKnown) fail(400, 'Choose a valid state under Admin → Restaurant → GST Registration before exporting.');
  const { b2b, b2c } = split(d.bills);
  const all = sumBills(d.bills);
  return {
    gstin: d.profile.gstin, fp: returnPeriod(d.dateTo), gt: all.total, cur_gt: all.total,
    b2b: b2bRows(b2b, d), b2c: [], b2cs: b2csRows(b2c, d.profile.stateCode),
    cdnr: [], cdnur: [], exp: [], at: [], txpd: [],
    hsn: { data: [{
      num: 1, hsn_sc: d.profile.sacCode, desc: 'Restaurant Services', uqc: 'OTH', cnt: all.count,
      txval: all.taxable, iamt: 0, camt: all.cgst, samt: all.sgst, csamt: 0 }] },
    doc_issue: { doc_det: [{ doc_num: 1, docs: documentsIssued(d.bills) }] },
  };
}

module.exports = { preview, portalJson, returnPeriod };
