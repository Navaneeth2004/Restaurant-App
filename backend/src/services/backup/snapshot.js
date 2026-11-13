'use strict';
/** Consistent copies of live restaurant databases (safe while orders are being taken). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const tenants = require('../../db/tenant/manager');
const central = require('../../db/central');
const files = require('../files/paths');

/** Writes a consistent copy of one restaurant's database to `destFile` (the handle cannot be evicted meanwhile). */
async function snapshotRestaurant(rid, destFile) {
  const release = tenants.hold(rid);
  try { await tenants.get(rid).raw.backup(destFile); } finally { release(); }
}

const snapshotCentral = (destFile) => central.backup(destFile);

/**
 * Zip of one restaurant: restaurant.db + uploads/. The caller pipes `archive` to the response and calls `cleanup()`
 * when the response ends or the client disconnects. The temp copy lives in a private (0700) folder.
 * @returns { filename, archive, cleanup }
 */
async function createBackupArchive(rid) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos_backup_'));
  fs.chmodSync(dir, 0o700);
  const tmp = path.join(dir, 'restaurant.db');
  const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* already gone */ } };
  try { await snapshotRestaurant(rid, tmp); } catch (e) { cleanup(); throw e; }

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('close', cleanup);
  archive.on('error', cleanup);
  archive.file(tmp, { name: 'restaurant.db' });
  archive.directory(files.uploadsDir(rid), 'uploads');
  archive.finalize();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return { filename: `pos_backup_${stamp}.zip`, archive, cleanup };
}

module.exports = { snapshotRestaurant, snapshotCentral, createBackupArchive };
