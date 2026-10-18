'use strict';
const fs = require('fs');
const path = require('path');
const cfg = require('../../config/env');
const restaurants = require('../../repositories/central/restaurants.repo');
const { snapshotRestaurant, snapshotCentral } = require('../../services/backup/snapshot');

const KEEP = 14;

module.exports = {
  'backup-all': {
    usage: 'backup-all [folder]               consistent copy of accounts.db + every restaurant DB (keeps the newest 14)',
    async run([folder]) {
      const dest = path.resolve(folder || path.join(cfg.DATA_DIR, '..', 'pos-backups'));
      const out = path.join(dest, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
      fs.mkdirSync(path.join(out, 'tenants'), { recursive: true });

      await snapshotCentral(path.join(out, 'accounts.db'));
      const ids = restaurants.idsAndFiles();
      for (const { id } of ids) await snapshotRestaurant(id, path.join(out, 'tenants', `${id}.db`));

      fs.readdirSync(dest).filter(n => /^\d{4}-/.test(n)).sort().slice(0, -KEEP)
        .forEach(n => fs.rmSync(path.join(dest, n), { recursive: true, force: true }));
      console.log(`Backed up accounts + ${ids.length} restaurant DB(s) to ${out}`);
      console.log('Photos are in DATA_DIR/files — copy that folder too (rsync / rclone).');
    },
  },
};
