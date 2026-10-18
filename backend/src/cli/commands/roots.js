'use strict';
const owners = require('../../repositories/central/owners.repo');
const providers = require('../../services/auth/providers');
const { uuid } = require('../../lib/crypto');
const { must, phonesOf } = require('./helpers');

module.exports = {
  'create-root': {
    usage: 'create-root <phone> <password>   create the ROOT login for /root (the only way to make one)',
    async run([phone, password]) {
      must(phone && password, 'usage: create-root <phone> <password>');
      must(String(password).length >= 10, 'A root password should be at least 10 characters');
      const phones = phonesOf(phone);
      const existing = owners.byPhones(phones);
      must(!existing || existing.role === 'root', 'That phone number is already a restaurant owner account. Use a different number for root.');
      const hash = await providers.get('password').hash(password);
      const now = new Date().toISOString();
      if (existing) owners.reviveRoot(existing.id, hash, now);
      else owners.insert({ id: uuid(), phone: phones[0], passwordHash: hash, role: 'root', now });
      console.log(`Root account ready for ${phones[0]}. Open https://<your-site>/root to log in.`);
    },
  },
  'list-roots': {
    usage: 'list-roots',
    run() { console.table(owners.listRoots()); },
  },
  'remove-root': {
    usage: 'remove-root <phone>',
    run([phone]) {
      must(phone, 'usage: remove-root <phone>');
      const removed = phonesOf(phone).reduce((n, p) => n + owners.removeRoot(p), 0);
      must(removed, 'No root account with that phone');
      console.log('Removed.');
    },
  },
};
