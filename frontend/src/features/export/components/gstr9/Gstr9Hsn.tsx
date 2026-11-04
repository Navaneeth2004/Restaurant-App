import { formatMoney } from 'lib/format/money';
import type { Gstr9 } from 'types/office/export';

const HEAD = ['HSN/SAC', 'Description', 'UQC', 'Total Qty', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'];

export default function Gstr9Hsn({ rows, sym }: { rows: Gstr9['hsn_summary']; sym: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="bg-surface-raised px-4 py-3 border-b border-surface-border">
        <p className="text-zinc-300 text-xs font-semibold">Part V — Table 17: HSN/SAC-wise Outward Summary</p>
        <p className="text-zinc-600 text-[10px] mt-0.5">Summary of all outward supplies grouped by SAC code.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-surface-border">{HEAD.map(h => <th key={h} scope="col" className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.hsn_sc} className="border-b border-surface-border/50">
                <td className="px-4 py-3 font-mono text-zinc-300 font-semibold">{r.hsn_sc}</td><td className="px-4 py-3 text-zinc-400">{r.desc}</td><td className="px-4 py-3 text-zinc-500">{r.uqc}</td>
                <td className="px-4 py-3 font-mono text-zinc-300">{r.qty}</td><td className="px-4 py-3 font-mono text-white font-semibold">{formatMoney(r.taxable, sym)}</td>
                {[r.igst, r.cgst, r.sgst, r.cess].map((v, i) => <td key={i} className="px-4 py-3 font-mono text-zinc-300">{formatMoney(v, sym)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-4 text-zinc-600 text-xs">No supplies in this financial year.</p>}
      </div>
    </div>
  );
}
