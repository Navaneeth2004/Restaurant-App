import Icon from 'components/ui/base/Icon';

export default function SentNotice({ ticketId, onAnother }: { ticketId: number | null; onAnother: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="w-20 h-20 rounded-full border bg-emerald-500/10 border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400"><Icon name="check" className="w-9 h-9" /></div>
      <h2 className="text-white font-bold text-xl mb-2">Ticket sent!</h2>
      <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mb-1">Your ticket{ticketId ? ` (#${ticketId})` : ''} reached support with full diagnostics.</p>
      <p className="text-zinc-600 text-xs max-w-xs mb-8">Support has your browser details, errors and device info — you don't need to send anything else.</p>
      <button type="button" onClick={onAnother} className="btn btn-brand px-6">Report another issue</button>
    </div>
  );
}
