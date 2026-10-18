'use strict';
/** Moves an old single-restaurant installation (restaurant.db + uploads) into the multi-restaurant layout. */
const fs = require('fs');
const path = require('path');
const cfg = require('../../config/env');
const ctx = require('../../db/context');
const tenants = require('../../db/tenant/manager');
const inspect = require('../../db/tenant/inspect');
const { migrate } = require('../../db/tenant/migrations');
const owners = require('../../repositories/central/owners.repo');
const restaurants = require('../../repositories/central/restaurants.repo');
const sessions = require('../../repositories/staff/staff-sessions.repo');
const tables = require('../../repositories/catalog/tables.repo');
const menu = require('../../repositories/catalog/menu.repo');
const settings = require('../../repositories/catalog/settings.repo');
const providers = require('../auth/providers');
const images = require('../files/images');
const { newRestaurantId } = require('../../lib/ids');
const { phoneVariants } = require('../../lib/phone');
const { uuid } = require('../../lib/crypto');

/** Re-homes photos and the logo from the old shared uploads folder. @returns number imported */
function importPhotos(rid, uploadSource) {
  const copied = new Map();
  let imported = 0;
  const copy = (imagePath, prefix, maxBytes) => {
    if (!imagePath || !uploadSource) return null;
    const name = path.basename(String(imagePath));
    const key = `${prefix}:${name}`;
    if (!copied.has(key)) {
      const url = images.storeImageFile(rid, path.join(uploadSource, name), { prefix, maxBytes });
      if (url) imported++;
      copied.set(key, url);
    }
    return copied.get(key);
  };
  for (const it of menu.imagePaths()) menu.setImage(it.id, copy(it.image_path, 'item', images.MAX_ITEM_IMAGE));
  const logo = settings.get('logo_url');
  if (logo) settings.set('logo_url', copy(logo, 'logo', images.MAX_LOGO_IMAGE) || '');
  return imported;
}

/** @returns { id, name, phone, pinsConverted, photosImported } */
async function importLegacy({ dbPath, phone, password, name, uploadsPath }) {
  const src = path.resolve(dbPath);
  if (!fs.existsSync(src)) throw new Error(`Database not found: ${src}`);
  const uploadSource = uploadsPath ? path.resolve(uploadsPath) : null;
  if (uploadSource && !(fs.existsSync(uploadSource) && fs.statSync(uploadSource).isDirectory())) throw new Error(`Uploads folder not found: ${uploadSource}`);
  const phones = phoneVariants(phone, cfg.DEFAULT_COUNTRY_CODE);
  if (!phones.length) throw new Error('Invalid phone number');
  const provider = providers.get('password');
  const problem = provider.validateNew(password);
  if (problem) throw new Error(problem);

  const id = newRestaurantId();
  const file = `${id}.db`;
  const dest = path.join(cfg.TENANT_DIR, file);
  const pinsConverted = inspect.plainPinCount(src);
  const restaurantName = name || inspect.restaurantName(src) || 'My Restaurant';
  const existingOwner = owners.byPhones(phones);
  const ownerId = existingOwner ? existingOwner.id : uuid();

  fs.copyFileSync(src, dest);
  try {
    const raw = tenants.openRaw(dest);
    try { migrate(raw); } finally { raw.close(); }       // adds new columns and hashes plain-text PINs

    restaurants.createWithOwner({
      owner: existingOwner ? null : { id: ownerId, phone: phones[0], passwordHash: await provider.hash(password) },
      restaurant: { id, ownerId, name: restaurantName, dbFile: file, now: new Date().toISOString() },
    });
  } catch (e) { tenants.remove(file); throw e; }

  return finishImport({ id, restaurantName, phones, pinsConverted, uploadSource });
}

function finishImport({ id, restaurantName, phones, pinsConverted, uploadSource }) {
  const photosImported = ctx.run({ restaurantId: id }, () => {
    tables.clearAllTokens();            // old QR codes cannot be routed; they must be re-created
    sessions.removeAll();
    return importPhotos(id, uploadSource);
  });
  return { id, name: restaurantName, phone: phones[0], pinsConverted, photosImported };
}

module.exports = { importLegacy };
