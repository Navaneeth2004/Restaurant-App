export function formatElapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return '< 1m';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function isUrgent(iso: string, thresholdMins = 20): boolean {
  return (Date.now() - new Date(iso).getTime()) > thresholdMins * 60000;
}

export function fmtCurrency(value: number, symbol = '₹'): string {
  return `${symbol}${value.toFixed(2)}`;
}
