import QrCode from 'components/qr/QrCode';
import { useToast } from 'state/toast/useToast';
import type { PairingCode } from 'types/core/auth';

export default function PairingCard({ pairing, secondsLeft }: { pairing: PairingCode; secondsLeft: number }) {
  const toast = useToast();
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const copy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(pairing.pair_url); toast('Link copied', 'success'); }
    catch { toast('Could not copy the link', 'error'); }
  };
  return (
    <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 flex flex-col sm:flex-row items-center gap-5">
      <div className="bg-white p-2.5 rounded-xl flex-shrink-0"><QrCode value={pairing.pair_url} size={150} /></div>
      <div className="text-center sm:text-left min-w-0">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Code</p>
        <p className="font-mono font-bold text-white text-4xl tracking-[0.25em] leading-tight" aria-label={`Pairing code ${pairing.code.split('').join(' ')}`}>{pairing.code}</p>
        <p className="text-zinc-400 text-xs mt-1" role="timer">Expires in <span className="font-mono text-white">{mm}:{ss}</span> · works once</p>
        <p className="text-zinc-600 text-[11px] mt-2 leading-relaxed">On the new device open this site, choose “I'm staff — connect with a code”, and type the code — or scan the QR with the phone camera.</p>
        <button type="button" className="btn btn-sm mt-3" onClick={() => { void copy(); }}>Copy link</button>
      </div>
    </div>
  );
}
