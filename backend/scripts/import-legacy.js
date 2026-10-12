'use strict';
/**
 * Moves an existing single-restaurant installation into the new multi-restaurant layout.
 *
 *   node scripts/import-legacy.js --db ../backend/data/restaurant.db \
 *        --phone 9876543210 --password 'a-strong-password' [--name "ABC Restaurant"] \
 *        [--uploads ../uploads]
 *
 * - copies the old database into DATA_DIR/tenants/<id>.db (the original file is left untouched)
 * - creates the owner account (or reuses it if the phone number already exists)
 * - hashes any plain-text staff PINs
 * - imports referenced JPG/PNG/WEBP/GIF photos from the old shared uploads folder, if provided
 * - clears old kiosk QR tokens (they must be re-created: Admin -> Tables -> QR)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const cfg = require('../core/config');
const central = require('../core/central');
const { migrate } = require('../core/schema');
const files = require('../core/files');
const { normalizePhone, newRestaurantId, nowIso } = require('../core/util');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];

(async () => {
  if (!args.db || !args.phone || !args.password) {
    console.error('Usage: node scripts/import-legacy.js --db <restaurant.db> --phone <number> --password <password> [--name "Restaurant name"] [--uploads <folder>]');
    process.exit(1);
  }
  const src = path.resolve(args.db);
  if (!fs.existsSync(src)) { console.error('Database not found:', src); process.exit(1); }
  const uploadSource = args.uploads ? path.resolve(args.uploads) : null;
  if (uploadSource && (!fs.existsSync(uploadSource) || !fs.statSync(uploadSource).isDirectory())) {
    console.error('Uploads folder not found:', uploadSource);
    process.exit(1);
  }
  const phone = normalizePhone(args.phone, cfg.DEFAULT_COUNTRY_CODE);
  if (!phone) { console.error('Invalid phone number'); process.exit(1); }
  if (String(args.password).length < 8) { console.error('Password must be at least 8 characters'); process.exit(1); }

  const id = newRestaurantId();
  const file = `${id}.db`;
  const dest = path.join(cfg.TENANT_DIR, file);
  fs.copyFileSync(src, dest);

  const raw = new Database(dest);
  raw.pragma('journal_mode = WAL');
  migrate(raw);

  // plain-text PINs -> bcrypt
  let hashed = 0;
  for (const s of raw.prepare('SELECT id, pin FROM staff').all()) {
    if (!/^\$2[ab]\$/.test(s.pin)) {
      raw.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(bcrypt.hashSync(String(s.pin), 10), s.id);
      hashed++;
    }
  }
  raw.prepare('UPDATE tables SET kiosk_token = NULL').run();
  raw.prepare('DELETE FROM staff_sessions').run();
  const nameRow = raw.prepare("SELECT value FROM settings WHERE key = 'restaurant_name'").get();
  const name = args.name || (nameRow && nameRow.value) || 'My Restaurant';

  let photosImported = 0;
  const copyImage = (imagePath, prefix, maxBytes, copied) => {
    if (!imagePath || !uploadSource) return null;
    const sourceName = path.basename(String(imagePath));
    const key = `${prefix}:${sourceName}`;
    if (copied.has(key)) return copied.get(key);
    if (!files.isAllowedName(sourceName)) return null;
    const source = path.join(uploadSource, sourceName);
    if (!fs.existsSync(source)) return null;
    const stat = fs.statSync(source);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const stored = files.newName(prefix, path.extname(sourceName));
    fs.copyFileSync(source, path.join(files.uploadsDir(id), stored));
    const url = files.publicUrl(id, stored);
    copied.set(key, url);
    photosImported++;
    return url;
  };
  const copied = new Map();
  const updateItemImage = raw.prepare('UPDATE menu_items SET image_path = ? WHERE id = ?');
  for (const item of raw.prepare('SELECT id, image_path FROM menu_items WHERE image_path IS NOT NULL').all()) {
    updateItemImage.run(copyImage(item.image_path, 'item', 5 * 1024 * 1024, copied), item.id);
  }
  const logo = raw.prepare("SELECT value FROM settings WHERE key = 'logo_url'").get();
  if (logo) {
    const logoUrl = copyImage(logo.value, 'logo', 2 * 1024 * 1024, copied) || '';
    raw.prepare("UPDATE settings SET value = ? WHERE key = 'logo_url'").run(logoUrl);
  }
  raw.close();

  let owner = central.prepare('SELECT id FROM owners WHERE phone = ?').get(phone);
  if (!owner) {
    owner = { id: crypto.randomUUID() };
    central.prepare('INSERT INTO owners (id, phone, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)')
      .run(owner.id, phone, await bcrypt.hash(String(args.password), 11), nowIso(), nowIso());
  }
  central.prepare('INSERT INTO restaurants (id, owner_id, name, db_file, created_at) VALUES (?,?,?,?,?)')
    .run(id, owner.id, name, file, nowIso());

  console.log(`\nImported "${name}" as restaurant ${id}`);
  console.log(`Owner phone: ${phone}`);
  console.log(`Plain-text PINs converted: ${hashed}`);
  console.log(`Photos and logo imported: ${photosImported}`);
  console.log('NOTE: the old default PINs (0000 / 1111 / 2222) still work. Change them under Admin -> Staff.');
  console.log('NOTE: kiosk QR codes must be re-generated (Admin -> Tables -> QR).');
  if (!uploadSource) console.log('NOTE: photos and logo were cleared; upload them again in the app.\n');
})().catch(e => { console.error('Import failed:', e); process.exit(1); });