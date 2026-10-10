'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cfg = require('../core/config');
const central = require('../core/central');
const tenants = require('../core/tenants');

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

function main() {
  const args = readArgs(process.argv.slice(2));
  const source = args.db ? path.resolve(args.db) : '';
  const phone = String(args.phone || '').replace(/\D/g, '').slice(-15);
  const password = String(args.password || '');
  const restaurantName = String(args.name || '').trim();
  if (!source || !fs.existsSync(source) || !phone || phone.length < 7 ||
      password.length < 8 || !restaurantName) {
    throw new Error('Usage: node scripts/import-legacy.js --db <file> --phone <number> --password <password> --name <restaurant>');
  }
  if (central.prepare('SELECT 1 FROM owners WHERE phone = ?').get(phone)) {
    throw new Error('An owner account with this phone number already exists.');
  }

  const ownerId = uuidv4();
  const restaurantId = uuidv4();
  const destination = tenants.tenantPath(restaurantId);
  const now = new Date().toISOString();
  let copied = false;
  try {
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    copied = true;
    central.transaction(() => {
      central.prepare('INSERT INTO owners (id, phone, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(ownerId, phone, bcrypt.hashSync(password, 12), now);
      central.prepare('INSERT INTO restaurants (id, owner_id, name, active, created_at) VALUES (?, ?, ?, 1, ?)')
        .run(restaurantId, ownerId, restaurantName.slice(0, 60), now);
    })();
    const tenantDb = tenants.databaseFor(restaurantId);
    tenantDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('restaurant_name', ?)")
      .run(restaurantName.slice(0, 60));
    console.log(`Imported "${restaurantName}" into ${destination}`);
    console.log('The source database was copied and left unchanged.');
  } catch (err) {
    tenants.closeAll();
    try {
      central.prepare('DELETE FROM restaurants WHERE id = ?').run(restaurantId);
      central.prepare('DELETE FROM owners WHERE id = ?').run(ownerId);
    } catch (cleanupError) {
      console.error('[Import] Account cleanup failed:', cleanupError.message);
    }
    if (copied) {
      try { fs.unlinkSync(destination); }
      catch (cleanupError) { console.error('[Import] Tenant-file cleanup failed:', cleanupError.message); }
    }
    throw err;
  } finally {
    tenants.closeAll();
    central.close();
  }
}

try {
  main();
} catch (err) {
  console.error(`[Import] ${err.message}`);
  process.exitCode = 1;
}
