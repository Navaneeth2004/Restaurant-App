'use strict';
/** Factory reset of ONE restaurant: orders, history, photos, menu, tables and settings. Staff accounts are kept. */
const db = require('../../db/tenant');
const tx = require('../../db/tenant/tx');
const seed = require('../../db/tenant/seed');
const { fail } = require('../../lib/http');
const orders = require('../../repositories/orders/orders.repo');
const orderItems = require('../../repositories/orders/order-items.repo');
const deleted = require('../../repositories/orders/deleted-records.repo');
const sessions = require('../../repositories/staff/staff-sessions.repo');
const tables = require('../../repositories/catalog/tables.repo');
const menu = require('../../repositories/catalog/menu.repo');
const categories = require('../../repositories/catalog/categories.repo');
const files = require('../files/paths');

const CONFIRM_PHRASE = 'RESET EVERYTHING';

function factoryReset(rid, confirm) {
  if (confirm !== CONFIRM_PHRASE) fail(400, 'Confirmation phrase incorrect');
  tx(() => {
    orderItems.removeAll();
    orders.deleteAll();
    deleted.deleteAll();
    sessions.removeAll();
    tables.deleteAll();
    menu.deleteAll();
    categories.deleteAll();
    seed.seedTables(db);
    seed.seedCategories(db);
    seed.applySettings(db, { overwrite: true, except: ['restaurant_name'] });
  });
  files.clearUploads(rid);
  return 'Factory reset complete. Orders, history, photos, menu, tables and settings were reset. Staff accounts were kept.';
}

module.exports = { factoryReset };
