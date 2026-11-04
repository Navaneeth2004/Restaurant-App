import { useCallback, useState } from 'react';
import { useAsync } from 'hooks/async/useAsync';
import { validateRange } from 'lib/format/local-time';
import { activePreset, Preset, presetRange, Range } from './range';

/**
 * A GST report for a date range: range state with presets, validation, and the request.
 * `fetcher` must be a stable function (a module-level api call). An invalid range sends no request.
 */
export function useGstReport<T>(fetcher: (range: Range, signal: AbortSignal) => Promise<T>) {
  const [range, setRange] = useState<Range>(() => presetRange('month'));
  const rangeError = validateRange(range.from, range.to);
  const load = useCallback(async (s: AbortSignal): Promise<T | null> => (rangeError ? null : fetcher(range, s)), [fetcher, range, rangeError]);
  const report = useAsync(load);
  const choose = useCallback((p: Preset) => setRange(presetRange(p)), []);
  return { range, setRange, rangeError, preset: activePreset(range), choose, ...report };
}
