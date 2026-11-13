'use strict';
/** Replaces a restaurant's data from a backup zip (restaurant.db + uploads/). The database is validated in depth first. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const cfg = require('../../config/env');
const { fail } = require('../../lib/http');
const tenants = require('../../db/tenant/manager');
const inspect = require('../../db/tenant/inspect');
const restaurants = require('../../repositories/central/restaurants.repo');
const limits = require('../restaurants/limits');
const files = require('../files/paths');
const { MAX_ITEM_IMAGE } = require('../files/images');
const { tidyRestoredData } = require('./tidy');

const MAX_ENTRIES = 3000;
const MAX_UNCOMPRESSED = 300 * 1024 * 1024;

function readZip(buffer) {
  let zip;
  try { zip = new AdmZip(buffer); } catch (_) { return fail(400, 'That is not a valid backup file.'); }
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) fail(400, 'Backup has too many files.');
  if (entries.reduce((s, e) => s + (e.header.size || 0), 0) > MAX_UNCOMPRESSED) fail(400, 'Backup is too large.');
  const dbEntry = zip.getEntry('restaurant.db');
  if (!dbEntry) fail(400, 'Invalid backup — restaurant.db not found');
  return { entries, dbEntry };
}

function restorePhotos(rid, entries) {
  const dir = files.uploadsDir(rid);
  let restored = 0;
  for (const e of entries) {
    if (e.isDirectory || !e.entryName.startsWith('uploads/')) continue;
    const base = path.basename(e.entryName);
    if (!files.isAllowedName(base) || e.header.size > MAX_ITEM_IMAGE) continue;
    const data = e.getData();
    if (data.length > MAX_ITEM_IMAGE) continue;
    files.assertQuota(rid);
    fs.writeFileSync(path.join(dir, base), data);   // keep the original name so photo links stay valid
    restored++;
  }
  return restored;
}

/** The backup must not give the restaurant more staff or tables than its plan allows. */
function assertWithinPlan(rid, stats) {
  const r = restaurants.byId(rid);
  if (!limits.check(r, 'max_staff', Math.max(0, stats.staffActive - 1)).ok) fail(403, 'This backup has more staff accounts than your plan allows.', { code: 'plan_limit' });
  if (!limits.check(r, 'max_tables', Math.max(0, stats.tables - 1)).ok) fail(403, 'This backup has more tables than your plan allows.', { code: 'plan_limit' });
}

/** @returns { imagesRestored } */
function restoreFromZip(rid, buffer) {
  const { entries, dbEntry } = readZip(buffer);
  const stage = path.join(os.tmpdir(), `pos_restore_${rid}_${Date.now()}.db`);
  try {
    fs.writeFileSync(stage, dbEntry.getData(), { mode: 0o600 });
    if (!inspect.looksLikePosBackup(stage)) fail(400, 'Invalid backup — this does not look like a POS backup.');
    const checked = inspect.validateBackup(stage);          // integrity, schema, required columns (the staged copy is migrated)
    if (checked.error) fail(400, checked.error);
    assertWithinPlan(rid, checked);

    const target = path.join(cfg.TENANT_DIR, restaurants.byId(rid).db_file);
    tenants.close(rid);
    for (const suffix of ['-wal', '-shm']) { try { fs.unlinkSync(target + suffix); } catch (_) { /* none */ } }
    fs.copyFileSync(stage, target);

    tenants.get(rid);                  // reopen
    tidyRestoredData(rid);
    return { imagesRestored: restorePhotos(rid, entries) };
  } finally {
    try { fs.unlinkSync(stage); } catch (_) { /* already gone */ }
  }
}

module.exports = { restoreFromZip };
