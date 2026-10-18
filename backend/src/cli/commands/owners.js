'use strict';
const owners = require('../../repositories/central/owners.repo');
const lifecycle = require('../../services/restaurants/lifecycle');
const { must, ownerByPhone } = require('./helpers');

module.exports = {
  'set-password': {
    usage: 'set-password <phone> <newPassword>   (owner forgot the password)',
    async run([phone, password]) {
      must(phone && password, 'usage: set-password <phone> <newPassword>');
      await lifecycle.setOwnerPassword(ownerByPhone(phone).id, password);
      console.log('Password updated.');
    },
  },
  'disable-owner': {
    usage: 'disable-owner <phone>',
    run([phone]) { must(phone, 'usage: disable-owner <phone>'); owners.setDisabled(ownerByPhone(phone).id, true); console.log('Done.'); },
  },
  'enable-owner': {
    usage: 'enable-owner <phone>',
    run([phone]) { must(phone, 'usage: enable-owner <phone>'); owners.setDisabled(ownerByPhone(phone).id, false); console.log('Done.'); },
  },
};
