'use strict';
/** Validates the item lines of an order request. */
const { fail } = require('../../lib/http');
const { clip, isNum } = require('../../lib/input');
const menu = require('../../repositories/catalog/menu.repo');

const MAX_LINES = 100;
const MAX_QTY = 999;

/**
 * @param items          request body `items`
 * @param authoritative  true for customer (QR) orders: name and price are read from the menu, never from the client
 * @returns [{ menu_item_id, name, price, quantity, note }]
 */
function normalizeItems(items, { authoritative = false } = {}) {
  if (!Array.isArray(items) || !items.length) fail(400, 'items required');
  if (items.length > MAX_LINES) fail(400, `An order can have at most ${MAX_LINES} lines.`);

  return items.map((it) => {
    const menuItemId = Number(it && it.menu_item_id);
    const quantity = parseInt(it && it.quantity, 10);
    if (!Number.isInteger(menuItemId) || menuItemId < 1) fail(400, 'Each item needs a valid menu_item_id.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) fail(400, `Quantity must be between 1 and ${MAX_QTY}.`);
    const note = clip(it.note, 200);

    if (authoritative) {
      const row = menu.rawById(menuItemId);
      if (!row || !row.available) fail(400, `${row ? `"${row.name}"` : 'An item'} is not available right now.`);
      return { menu_item_id: menuItemId, name: row.name, price: row.price, quantity, note };
    }

    const price = parseFloat(it.price);
    const name = clip(it.name, 80);
    if (!isNum(price) || price < 0) fail(400, 'Each item needs a valid price.');
    if (!name) fail(400, 'Each item needs a name.');
    return { menu_item_id: menuItemId, name, price, quantity, note };
  });
}

module.exports = { normalizeItems };
