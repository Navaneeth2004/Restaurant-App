/** Play the "new order received" chime — ascending 4-note arpeggio */
export function playChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  } catch { /* silent fail */ }
}

/**
 * Play the "order delivered / food ready" chime — two descending tones,
 * distinct from the kitchen new-order chime so staff can tell them apart.
 *
 * Sound: a short "ding-dong" using two sine waves.
 */
export function playDeliveryChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const notes = [
      { freq: 880, start: 0,    dur: 0.35, peak: 0.22 },   // high ding
      { freq: 660, start: 0.28, dur: 0.5,  peak: 0.18 },   // lower dong
    ];

    notes.forEach(({ freq, start, dur, peak }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  } catch { /* silent fail */ }
}