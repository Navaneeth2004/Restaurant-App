'use strict';
const audit = require('../../repositories/central/audit.repo');

/** @param actor { owner: {id, phone} | null, ip } */
function record(actor, action, target, detail) {
  const who = (actor && actor.owner) || {};
  let text = null;
  if (detail !== undefined) text = (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 2000);
  audit.insert({
    at: new Date().toISOString(), ownerId: who.id || null, ownerPhone: who.phone || null,
    action, target: target || null, detail: text, ip: (actor && actor.ip) || null,
  });
}

const list = (limit) => audit.list(Math.min(parseInt(limit, 10) || 200, 500));

module.exports = { record, list };
