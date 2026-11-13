'use strict';
/** Imports a menu.zip (or a plain JSON body). Existing categories/items are never changed; only new ones are added. */
const path = require('path');
const AdmZip = require('adm-zip');
const tx = require('../../db/tenant/tx');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const { round2 } = require('../../lib/money');
const categories = require('../../repositories/catalog/categories.repo');
const menu = require('../../repositories/catalog/menu.repo');
const images = require('../files/images');

const MAX_CATEGORIES = 200, MAX_ITEMS = 5000, MAX_ENTRIES = 6000, MAX_IMAGES = 2000;
const MAX_TOTAL = 100 * 1024 * 1024;
const MAX_JSON = 5 * 1024 * 1024;
const MAX_PRICE = 1000000;

/** Reads the zip and stores ONLY the photos that an item refers to. @returns { categories, items, imageMap, imagesImported } */
function readZip(rid, buffer) {
  let zip;
  try { zip = new AdmZip(buffer); } catch (_) { return fail(400, 'That is not a valid menu file.'); }
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) fail(400, 'The file has too many entries.');
  if (entries.reduce((s, e) => s + (e.header.size || 0), 0) > MAX_TOTAL) fail(400, 'The menu file is too large once unpacked.');
  const jsonEntry = zip.getEntry('menu.json');
  if (!jsonEntry) fail(400, 'ZIP must contain menu.json');
  if (jsonEntry.header.size > MAX_JSON) fail(400, 'menu.json is too large.');
  let parsed;
  try { parsed = JSON.parse(jsonEntry.getData().toString('utf8')); } catch (_) { return fail(400, 'menu.json is not valid.'); }

  const wanted = new Set((Array.isArray(parsed.items) ? parsed.items : [])
    .map(i => (i && i.image_path ? path.basename(String(i.image_path)) : null)).filter(Boolean));

  const imageMap = {};
  let imagesImported = 0;
  for (const e of entries) {
    if (e.isDirectory || !e.entryName.startsWith('images/')) continue;
    const original = path.basename(e.entryName);
    if (!wanted.has(original) || imageMap[original] || imagesImported >= MAX_IMAGES) continue;
    if (e.header.size > images.MAX_ITEM_IMAGE) continue;
    const data = e.getData();
    if (data.length > images.MAX_ITEM_IMAGE) continue;
    const url = images.storeImageBuffer(rid, original, data);
    if (url) { imageMap[original] = url; imagesImported++; }
  }
  return { categories: parsed.categories, items: parsed.items, imageMap, imagesImported };
}

function insertAll({ categories: cats, items, imageMap }, results) {
  const byName = {};
  categories.list().forEach(c => { byName[c.name.toLowerCase()] = c.id; });
  let order = categories.maxSort();
  for (const c of cats) {
    const name = clip(c && c.name, 60);
    if (!name || byName[name.toLowerCase()]) continue;
    byName[name.toLowerCase()] = categories.insert(name, ++order);
    results.categories_added++;
  }
  for (const item of items) {
    const name = clip(item && item.name, 80);
    const price = Number(item && item.price);
    const catId = byName[clip(item && item.category_name, 60).toLowerCase()];
    if (!name || !Number.isFinite(price) || price < 0 || price > MAX_PRICE || !catId || menu.existsByName(name, catId)) { results.items_skipped++; continue; }
    menu.insert({
      name, description: clip(item.description, 500), price: round2(price), categoryId: catId, available: item.available ? 1 : 0,
      imagePath: item.image_path ? (imageMap[path.basename(String(item.image_path))] || null) : null,
      sortOrder: menu.maxSort(catId) + 1,
    });
    results.items_added++;
  }
}

/** @param source { buffer } for a zip upload, or { body } for JSON */
function importMenu(rid, source) {
  const data = source.buffer
    ? readZip(rid, source.buffer)
    : { categories: source.body && source.body.categories, items: source.body && source.body.items, imageMap: {}, imagesImported: 0 };

  if (!Array.isArray(data.categories) || !Array.isArray(data.items)) fail(400, 'Invalid menu file — missing categories or items.');
  if (data.categories.length > MAX_CATEGORIES || data.items.length > MAX_ITEMS) fail(400, 'The menu file is too large.');

  const results = { categories_added: 0, items_added: 0, items_skipped: 0, images_imported: data.imagesImported };
  tx(() => insertAll(data, results));
  return results;
}

module.exports = { importMenu };
