'use strict';
const restaurants = require('../../repositories/central/restaurants.repo');
const tenants = require('../../db/tenant/manager');

module.exports = {
  migrate: {
    usage: 'migrate                           open every restaurant DB once so schema updates apply now',
    run() {
      const ids = restaurants.idsAndFiles();
      for (const { id } of ids) { tenants.get(id); process.stdout.write('.'); }
      console.log(`\nMigrated ${ids.length} restaurant database(s).`);
    },
  },
};
