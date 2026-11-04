import type { Gstr1Preview, Gstr3b, Gstr9 } from 'types/office/export';
import { annualOutwardRows, b2bRows, copyText, hsnRows, outwardRows, totalsRows } from './gst-rows';

const g1 = {
  item_qty: 7, b2cs: { invoice_count: 2, taxable_value: 100, central_tax: 2.5, state_ut_tax: 2.5 },
  b2b: { invoice_count: 1, gstin_count: 1, taxable_value: 50, central_tax: 1.25, state_ut_tax: 1.25 },
  totals: { taxable_value: 150, central_tax: 3.75, state_ut_tax: 3.75, total_tax: 7.5, total_incl_tax: 157.5 },
  hsn_summary: [{ hsn_sc: '9963', desc: 'Restaurant Services', uqc: 'OTH', qty: 7, taxable: 150, central_tax: 3.75, state_ut_tax: 3.75 }],
} as Gstr1Preview;

test('GSTR-1 rows come straight from the server figures', () => {
  expect(b2bRows(g1).map(r => r.value)).toEqual([50, 1.25, 1.25]);
  expect(totalsRows(g1).at(-1)).toEqual({ label: 'Grand Total (incl. tax)', value: 157.5, emphasis: true });
});

test('the HSN table shows the quantity as a plain count and is empty when the server sent no SAC row', () => {
  expect(hsnRows(g1)[0]).toEqual({ label: 'Total Quantity', value: 7, kind: 'count' });
  expect(hsnRows({ ...g1, hsn_summary: [] })).toEqual([]);
});

test('copying gives a bare number: never a currency symbol, counts without decimals', () => {
  expect(copyText({ label: 'x', value: 1234.5 })).toBe('1234.50');
  expect(copyText({ label: 'q', value: 7, kind: 'count' })).toBe('7');
});

test('IGST and cess are the server values, not a hard-coded zero', () => {
  const g3 = { outward_taxable: { total_taxable_value: 10, integrated_tax: 1.5, central_tax: 0, state_ut_tax: 0, cess: 0.25, total_tax: 0, total_incl_tax: 0 } } as Gstr3b;
  expect(outwardRows(g3).map(r => r.value)).toEqual([10, 1.5, 0, 0, 0.25]);
  const g9 = { outward: { b2b_taxable: 1, b2c_taxable: 2, total_taxable: 3, total_igst: 4, total_cgst: 5, total_sgst: 6, total_cess: 7 } } as Gstr9;
  expect(annualOutwardRows(g9).map(r => r.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
});
