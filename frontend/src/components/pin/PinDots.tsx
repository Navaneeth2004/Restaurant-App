import { MAX_PIN_LENGTH } from 'config/constants';

export default function PinDots({ length, shake = false }: { length: number; shake?: boolean }) {
  return (
    <div className={`flex justify-center gap-3 ${shake ? 'animate-shake' : ''}`} aria-label={`${length} digits entered`}>
      {Array.from({ length: MAX_PIN_LENGTH }, (_, i) => (
        <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${i < length ? 'bg-brand-500 border-brand-500 scale-110' : 'bg-transparent border-zinc-700'}`} />
      ))}
    </div>
  );
}
