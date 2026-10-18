'use strict';
const restaurants = require('../../repositories/central/restaurants.repo');
const lifecycle = require('../../services/restaurants/lifecycle');
const { must } = require('./helpers');

module.exports = {
  list: {
    usage: 'list                              all restaurants',
    run() {
      console.table(restaurants.listForCli().map(r => ({
        id: r.id, name: r.name, owner: r.phone, status: r.status, plan: r.plan, devices: r.devices, created: r.created_at.slice(0, 10),
      })));
    },
  },
  suspend: {
    usage: 'suspend <restaurantId>            block every device of that restaurant',
    run([id]) { must(id, 'restaurantId required'); lifecycle.suspend(id, null); console.log(`${id} is now suspended (takes effect on the next request).`); },
  },
  activate: {
    usage: 'activate <restaurantId>',
    run([id]) { must(id, 'restaurantId required'); lifecycle.activate(id); console.log(`${id} is now active.`); },
  },
  'revoke-devices': {
    usage: 'revoke-devices <restaurantId>     (e.g. after a security scare)',
    run([id]) { must(id, 'restaurantId required'); console.log(`${lifecycle.revokeDevices(id)} device(s) revoked. Everyone must link their device again.`); },
  },
  'delete-restaurant': {
    usage: 'delete-restaurant <id> --yes      PERMANENT: database + photos',
    run([id, confirm]) {
      must(id, 'restaurantId required');
      must(confirm === '--yes', 'This permanently deletes the restaurant. Re-run with --yes to confirm.');
      const r = lifecycle.deleteRestaurant(id);
      console.log(`Deleted restaurant ${id} (${r.name}). The owner account was kept.`);
    },
  },
};
