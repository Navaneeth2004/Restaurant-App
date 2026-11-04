export const SEVERITIES = [
  { key: 'low', label: 'Low', desc: 'Minor annoyance, workaround exists', color: '#6b7280' },
  { key: 'medium', label: 'Medium', desc: 'Feature broken, affects daily use', color: '#f59e0b' },
  { key: 'high', label: 'High', desc: 'Major feature unusable or data wrong', color: '#f97316' },
  { key: 'critical', label: 'Critical', desc: 'App crashed, orders lost, data corrupted', color: '#ef4444' },
] as const;
export type Severity = typeof SEVERITIES[number]['key'];

export const CATEGORIES = [
  { key: 'orders', label: 'Orders & Kitchen' }, { key: 'billing', label: 'Billing & Payment' }, { key: 'menu', label: 'Menu & Categories' },
  { key: 'tables', label: 'Tables & Floor' }, { key: 'staff', label: 'Staff & Login' }, { key: 'reports', label: 'Reports & Export' },
  { key: 'settings', label: 'Settings & Backup' }, { key: 'display', label: 'Display / UI' }, { key: 'other', label: 'Other' },
] as const;

export const TICKET_LIMITS = { title: 120, steps: 30 } as const;
