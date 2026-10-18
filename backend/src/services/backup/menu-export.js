'use strict';
/** Menu backup/move: a zip with menu.json + images/. */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const categories = require('../../repositories/catalog/categories.repo');
const menu = require('../../repositories/catalog/menu.repo');
const files = require('../files/paths');

/** @returns { filename, archive } — the caller pipes `archive` to the response */
function createMenuArchive(rid) {
  const items = menu.list();
  const payload = JSON.stringify({
    exported_at: new Date().toISOString(),
    version: 2,
    categories: categories.list().map(c => ({ name: c.name, sort_order: c.sort_order })),
    items: items.map(i => ({
      name: i.name, description: i.description, price: i.price, category_name: i.category_name,
      available: i.available, sort_order: i.sort_order, image_path: i.image_path,
    })),
  }, null, 2);

  const photos = items.filter(i => i.image_path)
    .map(i => ({ disk: files.resolveUpload(rid, i.image_path), zip: `images/${path.basename(i.image_path)}` }))
    .filter(f => f.disk && fs.existsSync(f.disk));

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.append(payload, { name: 'menu.json' });
  photos.forEach(f => archive.file(f.disk, { name: f.zip }));
  archive.finalize();
  return { filename: `menu_export_${new Date().toISOString().slice(0, 10)}.zip`, archive };
}

module.exports = { createMenuArchive };
