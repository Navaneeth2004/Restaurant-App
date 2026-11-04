/** Socket.IO event names (backend contract). */
export const EVENTS = {
  newOrder: 'new_order',
  orderUpdated: 'order_updated',
  orderAdditions: 'order_additions',
  orderDelivered: 'order_delivered',
  orderClosed: 'order_closed',
  orderItemCancelled: 'order_item_cancelled',
  orderRoundCancelled: 'order_round_cancelled',
  tablesUpdated: 'tables_updated',
  menuUpdated: 'menu_updated',
  categoriesUpdated: 'categories_updated',
  settingsUpdated: 'settings_updated',
  billRequested: 'bill_requested',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];

export const CLIENT_EVENTS = { joinStaff: 'join_staff', leaveStaff: 'leave_staff' } as const;

/** Window events used to cross layer boundaries without importing UI from api/. */
export const WINDOW_EVENTS = {
  deviceLost: 'pos-device-lost',
  staffRequired: 'pos-staff-required',
  rootAuthLost: 'root-auth-lost',
  forbidden: 'pos-forbidden',
} as const;
