/** Mirror of backend config/features.js. Root switches these on/off per subscription, per restaurant or for everyone. */
export const FEATURE = {
  waiter: 'waiter', kitchen: 'kitchen', support: 'support',
  adminFloor: 'admin.floor', adminRestaurant: 'admin.restaurant', adminTables: 'admin.tables', adminMenu: 'admin.menu',
  adminCategories: 'admin.categories', adminStaff: 'admin.staff', adminDevices: 'admin.devices',
  reportsAnalytics: 'reports.analytics', reportsHistory: 'reports.history', reportsDeleted: 'reports.deleted',
  exportGstr1: 'export.gstr1', exportGstr3b: 'export.gstr3b', exportGstr9: 'export.gstr9', exportRevenue: 'export.revenue',
  backupDownload: 'backup.download', backupRestore: 'backup.restore', backupReset: 'backup.reset',
  kiosk: 'kiosk', parcel: 'parcel', menuTransfer: 'menu.transfer', paymentEdit: 'orders.payment_edit', deleteRecords: 'orders.delete_records',
} as const;

export type FeatureKey = typeof FEATURE[keyof typeof FEATURE];

const some = (...keys: FeatureKey[]): ReadonlyArray<FeatureKey> => keys;

/** The features behind each top-level screen: the screen is shown while ANY of them is on. */
export const SCREEN_FEATURES = {
  waiter: some(FEATURE.waiter),
  kitchen: some(FEATURE.kitchen),
  support: some(FEATURE.support),
  admin: some(FEATURE.adminFloor, FEATURE.adminRestaurant, FEATURE.adminTables, FEATURE.adminMenu, FEATURE.adminCategories, FEATURE.adminStaff, FEATURE.adminDevices),
  reports: some(FEATURE.reportsAnalytics, FEATURE.reportsHistory, FEATURE.reportsDeleted),
  export: some(FEATURE.exportGstr1, FEATURE.exportGstr3b, FEATURE.exportGstr9, FEATURE.exportRevenue),
  backup: some(FEATURE.backupDownload, FEATURE.backupRestore, FEATURE.backupReset),
} as const;
