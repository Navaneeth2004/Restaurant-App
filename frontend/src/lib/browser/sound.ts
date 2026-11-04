interface Tone { freq: number; start: number; dur: number; peak: number }

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function play(tones: Tone[]): void {
  const c = getContext();
  if (!c) return;
  for (const { freq, start, dur, peak } of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = c.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

const arpeggio = (freqs: number[], step: number, dur: number, peak: number): Tone[] =>
  freqs.map((freq, i) => ({ freq, start: i * step, dur, peak }));

export const playNewOrder = (): void => play(arpeggio([523.25, 659.25, 783.99, 1046.5], 0.14, 0.55, 0.18));
export const playCancel = (): void => play(arpeggio([523.25, 415.3, 349.23], 0.15, 0.5, 0.15));
export const playDelivered = (): void => play([
  { freq: 880, start: 0, dur: 0.35, peak: 0.22 },
  { freq: 660, start: 0.28, dur: 0.5, peak: 0.18 },
]);
export const playBillRequest = (): void => play([
  { freq: 1046.5, start: 0, dur: 0.3, peak: 0.2 },
  { freq: 1046.5, start: 0.22, dur: 0.3, peak: 0.2 },
  { freq: 1318.5, start: 0.44, dur: 0.45, peak: 0.18 },
]);
