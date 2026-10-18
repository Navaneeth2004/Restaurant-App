'use strict';
const { importLegacy } = require('../../services/backup/legacy-import');
const { must } = require('./helpers');

/** --db x --phone y ... -> { db: 'x', phone: 'y', ... } */
function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) out[String(args[i]).replace(/^--/, '')] = args[i + 1];
  return out;
}

module.exports = {
  'import-legacy': {
    usage: 'import-legacy --db <restaurant.db> --phone <number> --password <password> [--name "Name"] [--uploads <folder>]',
    async run(args) {
      const a = parseFlags(args);
      must(a.db && a.phone && a.password, 'Usage: import-legacy --db <restaurant.db> --phone <number> --password <password> [--name "Restaurant name"] [--uploads <folder>]');
      const r = await importLegacy({ dbPath: a.db, phone: a.phone, password: a.password, name: a.name, uploadsPath: a.uploads });
      console.log(`\nImported "${r.name}" as restaurant ${r.id}`);
      console.log(`Owner phone: ${r.phone}`);
      console.log(`Plain-text PINs converted: ${r.pinsConverted}`);
      console.log(`Photos and logo imported: ${r.photosImported}`);
      console.log('NOTE: kiosk QR codes must be re-generated (Admin -> Tables -> QR).');
      if (!a.uploads) console.log('NOTE: photos and logo were cleared; upload them again in the app.\n');
    },
  },
};
