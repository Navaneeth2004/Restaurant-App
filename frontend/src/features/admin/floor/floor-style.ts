import type { Heat } from './hooks/floor-metrics';

interface HeatStyle { border: string; bg: string; glow: string; pill: string; pillText: string; pillBorder: string; dot: string; tag: string; tagColor: string }

/** Colours per table state. Text colours use the theme tokens so the screen reads well in light mode. */
export const HEAT: Record<Heat, HeatStyle> = {
  empty: { border: 'var(--fl-border)', bg: 'transparent', glow: 'none', pill: '', pillText: '', pillBorder: '', dot: 'var(--fl-border2)', tag: 'Available', tagColor: 'var(--fl-faint)' },
  fresh: { border: '#10b981', bg: 'rgba(16,185,129,0.07)', glow: '0 4px 24px rgba(16,185,129,0.1)', pill: 'rgba(16,185,129,0.14)', pillText: 'var(--fl-green)', pillBorder: 'rgba(16,185,129,0.3)', dot: '#10b981', tag: 'Occupied', tagColor: 'var(--fl-green)' },
  warm: { border: '#f59e0b', bg: 'rgba(245,158,11,0.07)', glow: '0 4px 24px rgba(245,158,11,0.1)', pill: 'rgba(245,158,11,0.14)', pillText: 'var(--fl-amber)', pillBorder: 'rgba(245,158,11,0.3)', dot: '#f59e0b', tag: 'Occupied', tagColor: 'var(--fl-amber)' },
  hot: { border: '#ef4444', bg: 'rgba(239,68,68,0.07)', glow: '0 4px 24px rgba(239,68,68,0.12)', pill: 'rgba(239,68,68,0.14)', pillText: 'var(--fl-red)', pillBorder: 'rgba(239,68,68,0.3)', dot: '#ef4444', tag: 'Long wait', tagColor: 'var(--fl-red)' },
  bill: { border: '#818cf8', bg: 'rgba(129,140,248,0.07)', glow: '0 4px 24px rgba(129,140,248,0.1)', pill: 'rgba(129,140,248,0.14)', pillText: 'var(--fl-indigo)', pillBorder: 'rgba(129,140,248,0.3)', dot: '#818cf8', tag: 'Awaiting bill', tagColor: 'var(--fl-indigo)' },
};
