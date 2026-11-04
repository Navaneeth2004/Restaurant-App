const HOUR_MS = 3_600_000;

/**
 * Counts timestamps per hour over a sliding window ending now. Index `hours-1` is the most recent hour.
 * Uses absolute time, so it stays correct across midnight and for any timezone.
 */
export function hourBuckets(timestamps: ReadonlyArray<string>, nowMs: number, hours = 12): number[] {
  const bars = new Array<number>(hours).fill(0);
  for (const iso of timestamps) {
    const age = nowMs - new Date(iso).getTime();
    if (!Number.isFinite(age) || age < 0 || age >= hours * HOUR_MS) continue;
    bars[hours - 1 - Math.floor(age / HOUR_MS)] += 1;
  }
  return bars;
}
