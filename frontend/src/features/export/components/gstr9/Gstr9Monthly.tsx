import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import { formatMoney } from 'lib/format/money';
import type { Gstr9 } from 'types/office/export';

const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export default function Gstr9Monthly({ data: d, sym }: { data: Gstr9; sym: string }) {
  const [open, setOpen] = useState(false);
  const cols = ['Month', 'Visits', 'Taxable', 'CGST', 'SGST', 'Total Tax'];
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <button type="button" aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-raised/40 transition-colors" onClick={() => setOpen(o => !o)}>
        <span className="text-left"><span className="block text-zinc-300 text-xs font-semibold">Monthly Cross-Check — GSTR-3B Reconciliation</span>
          <span className="block text-zinc-600 text-[10px] mt-0.5">Verify each month's figures match what you declared in your GSTR-3B filings ({sym})</span></span>
        <Icon name="chevronDown" className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-surface-border overflow-x-auto">
          {d.monthly_breakdown.length === 0 ? <p className="px-4 py-4 text-zinc-600 text-xs">No orders in this financial year.</p> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-surface-border">{cols.map(h => <th key={h} scope="col" className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {d.monthly_breakdown.map(r => (
                  <tr key={r.month} className="border-b border-surface-border/50">
                    <td className="px-4 py-3 text-zinc-300 font-medium whitespace-nowrap">{monthLabel(r.month)}</td><td className="px-4 py-3 font-mono text-zinc-400">{r.sessions}</td>
                    <td className="px-4 py-3 font-mono text-white">{formatMoney(r.taxable, '')}</td><td className="px-4 py-3 font-mono text-zinc-300">{formatMoney(r.cgst, '')}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300">{formatMoney(r.sgst, '')}</td><td className="px-4 py-3 font-mono text-zinc-300">{formatMoney(r.tax, '')}</td>
                  </tr>
                ))}
                <tr className="bg-surface-raised/60 font-semibold">
                  <td className="px-4 py-3 text-zinc-300">Total FY {d.fy}</td><td className="px-4 py-3 font-mono text-zinc-300">{d.session_count}</td>
                  <td className="px-4 py-3 font-mono text-white">{formatMoney(d.outward.total_taxable, '')}</td><td className="px-4 py-3 font-mono text-zinc-300">{formatMoney(d.outward.total_cgst, '')}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{formatMoney(d.outward.total_sgst, '')}</td><td className="px-4 py-3 font-mono text-white">{formatMoney(d.tax_paid.total, '')}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
