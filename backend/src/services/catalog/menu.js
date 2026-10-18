'use strict';
/** Menu items. Photos arrive already stored by the uploader; this module only links/unlinks them. */
const { fail } = require('../../lib/http');
const { clip, toInt, isNum } = require('../../lib/input');
const menu = require('../../repositories/catalog/menu.repo');
const categories = require('../../repositories/catalog/categories.repo');
const files = require('../files/paths');

const list = () => menu.list();
const byCategory = (catId) => menu.byCategory(catId);

function parsePrice(value) {
  const price = parseFloat(value);
  if (!isNum(price) || price < 0) fail(400, 'Price must be a number that is 0 or more.');
  return price;
}

/** @param file multer file (or undefined) */
function create(rid, body, file) {
  const discard = () => { if (file) files.removeUpload(rid, file.filename); };
  try {
    const { name, description, price, category_id } = body;
    if (!name || price === undefined || price === '' || !category_id) fail(400, 'name, price, category_id required');
    const categoryId = toInt(category_id);
    if (!categories.byId(categoryId)) fail(400, 'Category not found');
    const id = menu.insert({
      name: clip(name, 80), description: clip(description, 500), price: parsePrice(price), categoryId,
      imagePath: file ? files.publicUrl(rid, file.filename) : null, sortOrder: menu.maxSort(categoryId) + 1,
    });
    return menu.withCategory(id);
  } catch (e) { discard(); throw e; }
}

function update(rid, id, body, file) {
  const discard = () => { if (file) files.removeUpload(rid, file.filename); };
  try {
    const existing = menu.rawById(id);
    if (!existing) fail(404, 'Not found');
    const { name, description, price, category_id, available } = body;

    let imagePath = existing.image_path;
    const categoryId = category_id ? toInt(category_id) : null;
    if (categoryId !== null && !categories.byId(categoryId)) fail(400, 'Category not found');
    const newPrice = price !== undefined && price !== '' ? parsePrice(price) : null;

    if (file) {
      if (existing.image_path) files.removeUpload(rid, existing.image_path);
      imagePath = files.publicUrl(rid, file.filename);
    }
    menu.update(id, {
      name: name ? clip(name, 80) : null,
      description: description === undefined ? null : clip(description, 500),
      price: newPrice, categoryId, imagePath,
      available: available !== undefined ? (available === 'true' || available === true ? 1 : 0) : null,
    });
    return menu.withCategory(id);
  } catch (e) { discard(); throw e; }
}

function reorder(items) {
  if (!Array.isArray(items) || !items.length) fail(400, 'items array required');
  menu.reorder(items);
  return { ok: true };
}

function remove(rid, id) {
  const item = menu.rawById(id);
  if (!item) fail(404, 'Not found');
  if (menu.inOpenOrder(id)) {
    fail(400, 'This item is part of an active or pending order. Cannot delete until those orders are closed.');
  }
  if (item.image_path) files.removeUpload(rid, item.image_path);
  menu.remove(id);
  return { success: true };
}

module.exports = { list, byCategory, create, update, reorder, remove };
