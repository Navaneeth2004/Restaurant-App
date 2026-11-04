import { sumLines } from 'lib/format/money';
import type { Rounds } from '../../hooks/rounds';
import RoundItems from './RoundItems';
import RoundSection from './RoundSection';

interface Props {
  rounds: Rounds; sym: string; hasCart: boolean;
  onCancelItem: (orderId: string, itemId: number) => void;
  onCancelRound: (orderId: string) => void;
}

/** Past (delivered / direct-billed) rounds and the round currently in the kitchen. */
export default function OrderRounds({ rounds, sym, hasCart, onCancelItem, onCancelRound }: Props) {
  const { direct, kitchen, active } = rounds;
  return (
    <>
      {direct.length > 0 && (
        <RoundSection label="Billed directly" dot="bg-zinc-500" labelClass="text-zinc-500" sym={sym} total={sumLines(direct.flatMap(o => o.items))}>
          {direct.map(o => <RoundItems key={o.id} items={o.items} sym={sym} muted onCancelItem={id => onCancelItem(o.id, id)} />)}
        </RoundSection>
      )}
      {kitchen.map((round, i) => (
        <RoundSection key={round.id} label={`Round ${i + 1} — Delivered`} dot="bg-emerald-500" labelClass="text-emerald-600" sym={sym}
          total={sumLines(round.items)} onCancelRound={() => onCancelRound(round.id)}>
          <RoundItems items={round.items} sym={sym} muted onCancelItem={id => onCancelItem(round.id, id)} />
        </RoundSection>
      ))}
      {active && active.items.length > 0 && (
        <RoundSection label={`${kitchen.length > 0 ? `Round ${kitchen.length + 1}` : 'Active Order'} — In Kitchen`} dot="bg-brand-500" labelClass="text-zinc-400"
          sym={sym} total={sumLines(active.items)} divider={hasCart} onCancelRound={() => onCancelRound(active.id)}>
          <RoundItems items={active.items} sym={sym} onCancelItem={id => onCancelItem(active.id, id)} />
        </RoundSection>
      )}
      {!active && (kitchen.length > 0 || direct.length > 0) && !hasCart && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />All delivered — add items or generate bill
          </p>
        </div>
      )}
    </>
  );
}
