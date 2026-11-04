import type { Gstr1Preview } from 'types/office/export';
import { b2bRows, b2csRows, hsnRows, totalsRows } from '../../hooks/gst-rows';
import AmountTable from '../shared/AmountTable';

const plural = (n: number, word: string): string => `${n} ${word}${n !== 1 ? 's' : ''}`;

export default function Gstr1Tables({ data: d, sym }: { data: Gstr1Preview; sym: string }) {
  return (
    <>
      <AmountTable title="B2CS — Walk-in Sales (Aggregate)" sym={sym} rows={b2csRows(d)}
        subtitle={`${plural(d.b2cs.invoice_count, 'invoice')} without customer GSTIN, grouped into one entry`} />
      <AmountTable title="B2B — Registered Customers (with GSTIN)" sym={sym} rows={b2bRows(d)}
        subtitle={`${plural(d.b2b.invoice_count, 'invoice')} across ${plural(d.b2b.gstin_count, 'customer GSTIN')}`} />
      <AmountTable title="HSN/SAC Summary" sym={sym} rows={hsnRows(d)} subtitle={`SAC ${d.hsn_summary[0]?.hsn_sc ?? d.sac_code} — Restaurant Services`} />
      <AmountTable title="Totals — B2CS + B2B Combined" sym={sym} rows={totalsRows(d)} subtitle="This is what gets bundled into the GSTR-1 JSON below" />
    </>
  );
}
