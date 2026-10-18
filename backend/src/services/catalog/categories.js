'use strict';
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const categories = require('../../repositories/catalog/categories.repo');

const list = () => categories.list();

function assertNameFree(name, exceptId) {
  const clash = categories.byName(name);
  if (clash && clash.id !== Number(exceptId)) fail(409, 'A category with this name already exists.');
}

function create(name) {
  const clean = clip(name, 60);
  if (!clean) fail(400, 'Name required');
  assertNameFree(clean, null);
  return categories.byId(categories.insert(clean, categories.maxSort() + 1));
}

function update(id, { name, sort_order }) {
  if (!categories.byId(id)) fail(404, 'Category not found');
  const clean = name ? clip(name, 60) : null;
  if (clean) assertNameFree(clean, id);
  categories.update(id, clean, sort_order ?? null);
  return { success: true };
}

function reorder(order) {
  if (!Array.isArray(order)) fail(400, 'order array required');
  categories.reorder(order);
  return { success: true };
}

function remove(id) {
  const count = categories.itemCount(id);
  if (count > 0) {
    if (categories.itemsInOpenOrders(id) > 0) {
      fail(400, `Cannot delete — ${count} item(s) in this category are part of active orders. Close those orders first.`);
    }
    fail(400, `Cannot delete — this category has ${count} menu item(s). Delete or reassign them first.`);
  }
  categories.remove(id);
  return { success: true };
}

module.exports = { list, create, update, reorder, remove };
