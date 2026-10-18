'use strict';
/** Clean-up after a restaurant database was replaced from outside (restore, legacy import). Runs in the restaurant's context. */
const path = require('path');
const ctx = require('../../db/context');
const sessions = require('../../repositories/staff/staff-sessions.repo');
const tables = require('../../repositories/catalog/tables.repo');
const menu = require('../../repositories/catalog/menu.repo');
const settings = require('../../repositories/catalog/settings.repo');
const files = require('../files/paths');

/** Photo links must point at THIS restaurant's folder (old backups, or a backup taken from another restaurant). */
function relinkPhotos(rid) {
  const relink = (v) => (v ? files.publicUrl(rid, path.basename(String(v))) : v);
  for (const it of menu.imagePaths()) {
    const fixed = relink(it.image_path);
    if (fixed !== it.image_path) menu.setImage(it.id, fixed);
  }
  const logo = settings.get('logo_url');
  if (logo) settings.set('logo_url', relink(logo));
}

function tidyRestoredData(rid) {
  ctx.run({ restaurantId: rid }, () => {
    sessions.removeAll();              // everyone must log in again
    tables.clearForeignTokens(rid);
    relinkPhotos(rid);
  });
}

module.exports = { tidyRestoredData };
