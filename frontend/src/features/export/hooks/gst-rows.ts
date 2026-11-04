import type { Gstr1Preview, Gstr3b, Gstr9, TaxBucket } from 'types/office/export';

/** One line of a figures table. `count` rows are plain numbers (no currency symbol). */
export interface AmountRow { label: string; value: number; kind?: 'money' | 'count'; emphasis?: boolean }

const bucket = (b: TaxBucket): AmountRow[] => [
  { label: 'Taxable Value', value: b.taxable_value },
  { label: 'Central Tax (CGST)', value: b.central_tax },
  { label: 'State/UT Tax (SGST)', value: b.state_ut_tax },
];

export const b2csRows = (d: Gstr1Preview): AmountRow[] => bucket(d.b2cs);
export const b2bRows = (d: Gstr1Preview): AmountRow[] => bucket(d.b2b);

export function hsnRows(d: Gstr1Preview): AmountRow[] {
  const h = d.hsn_summary[0];
  if (!h) return [];
  return [
    { label: 'Total Quantity', value: d.item_qty, kind: 'count' },
    { label: 'Taxable Value', value: h.taxable },
    { label: 'Central Tax (CGST)', value: h.central_tax },
    { label: 'State/UT Tax (SGST)', value: h.state_ut_tax },
  ];
}

export const totalsRows = (d: Gstr1Preview): AmountRow[] => [
  { label: 'Total Taxable Value', value: d.totals.taxable_value },
  { label: 'Total Central Tax (CGST)', value: d.totals.central_tax },
  { label: 'Total State/UT Tax (SGST)', value: d.totals.state_ut_tax },
  { label: 'Total Tax', value: d.totals.total_tax },
  { label: 'Grand Total (incl. tax)', value: d.totals.total_incl_tax, emphasis: true },
];

export const outwardRows = (d: Gstr3b): AmountRow[] => [
  { label: 'Total Taxable Value (pre-tax)', value: d.outward_taxable.total_taxable_value },
  { label: 'Integrated Tax (IGST)', value: d.outward_taxable.integrated_tax },
  { label: 'Central Tax (CGST)', value: d.outward_taxable.central_tax },
  { label: 'State/UT Tax (SGST)', value: d.outward_taxable.state_ut_tax },
  { label: 'Cess', value: d.outward_taxable.cess },
];

export const taxPaidRows = (p: { integrated_tax: number; central_tax: number; state_ut_tax: number; cess: number }): AmountRow[] => [
  { label: 'Integrated Tax (IGST)', value: p.integrated_tax },
  { label: 'Central Tax (CGST)', value: p.central_tax },
  { label: 'State/UT Tax (SGST)', value: p.state_ut_tax },
  { label: 'Cess', value: p.cess },
];

export const annualOutwardRows = (d: Gstr9): AmountRow[] => [
  { label: '4A — Supplies to registered persons (B2B)', value: d.outward.b2b_taxable },
  { label: '4C — Supplies to unregistered persons (B2C)', value: d.outward.b2c_taxable },
  { label: 'Total taxable value (pre-tax)', value: d.outward.total_taxable },
  { label: 'Integrated Tax (IGST)', value: d.outward.total_igst },
  { label: 'Central Tax (CGST)', value: d.outward.total_cgst },
  { label: 'State/UT Tax (SGST)', value: d.outward.total_sgst },
  { label: 'Cess', value: d.outward.total_cess },
];

/** What a row puts on the clipboard: a bare number the GST portal accepts (never a currency symbol). */
export const copyText = (r: AmountRow): string => (r.kind === 'count' ? String(r.value) : r.value.toFixed(2));
