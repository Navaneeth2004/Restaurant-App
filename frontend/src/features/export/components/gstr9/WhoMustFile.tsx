const RULES = [
  { text: 'Turnover above ₹2 crore → mandatory filing', color: 'text-red-400' },
  { text: 'Turnover ₹2 crore or below → optional (but recommended)', color: 'text-amber-400' },
  { text: 'GSTR-9C (audit reconciliation) required only above ₹5 crore', color: 'text-zinc-500' },
];

export default function WhoMustFile() {
  return (
    <div className="rounded-xl border border-zinc-700/60 bg-surface-card px-4 py-3">
      <p className="text-zinc-300 text-xs font-semibold mb-1.5">Who needs to file GSTR-9?</p>
      <ul className="space-y-1">{RULES.map(r => <li key={r.text} className={`flex items-start gap-2 text-[11px] ${r.color}`}><span aria-hidden className="mt-0.5">·</span>{r.text}</li>)}</ul>
    </div>
  );
}
