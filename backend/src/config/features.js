'use strict';
/**
 * Every switchable part of the app. Root turns these on/off per subscription, per restaurant, or for everyone at once.
 * To add one: add a line here and in frontend state/features/feature-keys.ts. A new feature is ON for everybody by default.
 * Never switchable on purpose: PIN login, device linking, the session heartbeat, reading settings, the root console.
 */
const FEATURES = [
  { key: 'waiter', label: 'Waiter screen', group: 'Staff screens' },
  { key: 'kitchen', label: 'Kitchen display', group: 'Staff screens' },
  { key: 'support', label: 'Ticket (bug report) screen', group: 'Staff screens' },

  { key: 'admin.floor', label: 'Floor view', group: 'Admin' },
  { key: 'admin.restaurant', label: 'Restaurant settings', group: 'Admin' },
  { key: 'admin.tables', label: 'Tables', group: 'Admin' },
  { key: 'admin.menu', label: 'Menu items', group: 'Admin' },
  { key: 'admin.categories', label: 'Categories', group: 'Admin' },
  { key: 'admin.staff', label: 'Staff accounts', group: 'Admin' },
  { key: 'admin.devices', label: 'Devices and pairing codes', group: 'Admin' },

  { key: 'reports.analytics', label: 'Analytics', group: 'Reports' },
  { key: 'reports.history', label: 'History', group: 'Reports' },
  { key: 'reports.deleted', label: 'Deleted records log', group: 'Reports' },

  { key: 'export.gstr1', label: 'GSTR-1 export', group: 'Export' },
  { key: 'export.gstr3b', label: 'GSTR-3B summary', group: 'Export' },
  { key: 'export.gstr9', label: 'GSTR-9 annual return', group: 'Export' },
  { key: 'export.revenue', label: 'Revenue report', group: 'Export' },

  { key: 'backup.download', label: 'Download backup', group: 'Backup' },
  { key: 'backup.restore', label: 'Restore backup', group: 'Backup' },
  { key: 'backup.reset', label: 'Factory reset', group: 'Backup' },

  { key: 'kiosk', label: 'Customer QR ordering', group: 'Capabilities' },
  { key: 'parcel', label: 'Parcel / takeaway slots', group: 'Capabilities' },
  { key: 'menu.transfer', label: 'Menu import and export', group: 'Capabilities' },
  { key: 'orders.payment_edit', label: 'Edit payment of closed bills', group: 'Capabilities' },
  { key: 'orders.delete_records', label: 'Delete closed visits from history', group: 'Capabilities' },
];

const KEYS = new Set(FEATURES.map(f => f.key));

module.exports = { FEATURES, KEYS };
