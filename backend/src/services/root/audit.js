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

/** @param query { limit, offset, q, source } straight from the request */
const list = (query = {}) => audit.list({
  limit: Math.min(parseInt(query.limit, 10) || 200, 500),
  offset: Math.max(parseInt(query.offset, 10) || 0, 0),
  q: String(query.q || '').trim().slice(0, 60),
  source: ['app', 'root'].includes(query.source) ? query.source : '',
});

module.exports = { record, list };