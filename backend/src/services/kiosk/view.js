'use strict';
/** What a customer's phone may read. */
const { isParcelId } = require('../../lib/ids');
const settings = require('../../repositories/catalog/settings.repo');
const categories = require('../../repositories/catalog/categories.repo');
const menu = require('../../repositories/catalog/menu.repo');
const orders = require('../../repositories/orders/orders.repo');
const { currentSessionId } = require('../orders/session');

function tableInfo(table) {
  const S = settings.all();
  return {
    kiosk_type: 'table',
    table_id: table.id, table_label: table.label, table_seats: table.seats, table_status: table.status,
    is_parcel: isParcelId(table.id),
    session_id: currentSessionId(table.id),
    restaurant_name: S.restaurant_name || 'Restaurant',
    brand_color: S.brand_color || '#f97316',
    currency_symbol: S.currency_symbol || '₹',
    tax_percent: S.tax_percent || '5',
    logo_url: S.logo_url || '',
    bill_footer: S.bill_footer || '',
    address: S.address || '',
    phone: S.phone || '',
  };
}

const menuForCustomer = () => ({ categories: categories.list(), items: menu.listAvailable() });

/** The running visit's orders (empty when the table is free). */
function tableOrders(table) {
  const sessionId = currentSessionId(table.id);
  return sessionId ? orders.sessionOrders(table.id, sessionId) : [];
}

module.exports = { tableInfo, menuForCustomer, tableOrders };
