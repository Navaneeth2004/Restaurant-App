import type { Gstr9 } from 'types/office/export';
import { annualOutwardRows, taxPaidRows } from '../../hooks/gst-rows';
import AmountTable from '../shared/AmountTable';

export default function Gstr9Tables({ data: d, sym }: { data: Gstr9; sym: string }) {
  return (
    <>
      <AmountTable title="Part II — Table 4: Outward Taxable Supplies" subtitle="Enter under GSTR-9 → Table 4 on the GST portal. Click any value to copy." sym={sym}
        rows={[...annualOutwardRows(d), { label: 'Total incl. tax (for your reference)', value: d.outward.total_incl_tax, emphasis: true }]} />
      <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
        <div className="bg-surface-raised px-4 py-3 border-b border-surface-border"><p className="text-zinc-300 text-xs font-semibold">Part II — Table 6: ITC Availed</p></div>
        <p className="px-4 py-3 text-zinc-500 text-xs leading-relaxed">{d.itc_note}</p>
      </div>
      <AmountTable title="Part II — Table 9: Tax Payable & Paid" subtitle={`Annual tax declared and paid across your GSTR-3B filings for FY ${d.fy}.`} sym={sym} rows={taxPaidRows(d.tax_paid)} />
    </>
  );
}
