'use strict';
/** Consistent copies of live restaurant databases (safe while orders are being taken). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const tenants = require('../../db/tenant/manager');
const central = require('../../db/central');
const files = require('../files/paths');

/** Writes a consistent copy of one restaurant's database to `destFile`. */
const snapshotRestaurant = (rid, destFile) => tenants.get(rid).raw.backup(destFile);

const snapshotCentral = (destFile) => central.backup(destFile);

/**
 * Zip of one restaurant: restaurant.db + uploads/. The caller pipes `archive` to the response.
 * @returns { filename, archive }
 */
async function createBackupArchive(rid) {
  const tmp = path.join(os.tmpdir(), `pos_${rid}_${Date.now()}.db`);
  await snapshotRestaurant(rid, tmp);

  const cleanup = () => { try { fs.unlinkSync(tmp); } catch (_) { /* already gone */ } };
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('close', cleanup);
  archive.on('error', cleanup);
  archive.file(tmp, { name: 'restaurant.db' });
  archive.directory(files.uploadsDir(rid), 'uploads');
  archive.finalize();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return { filename: `pos_backup_${stamp}.zip`, archive };
}

module.exports = { snapshotRestaurant, snapshotCentral, createBackupArchive };
