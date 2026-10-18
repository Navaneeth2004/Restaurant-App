'use strict';
/** Customer QR pages: resolving a token to a table, issuing tokens, and the LAN address helper. */
const os = require('os');
const { fail } = require('../../lib/http');
const { newKioskToken, restaurantIdFromKioskToken } = require('../../lib/ids');
const tables = require('../../repositories/catalog/tables.repo');

function requireTable(token) {
  const table = token ? tables.byToken(token) : null;
  if (!table) fail(404, 'Invalid or expired QR code');
  return table;
}

/** Returns the table's QR token, creating one (or replacing a legacy un-routable one) when needed. */
function ensureToken(rid, tableId) {
  const table = tableId ? tables.byId(String(tableId)) : null;
  if (!table || table.is_archived) fail(404, 'Table not found');
  const current = tables.tokenOf(table.id);
  if (current && restaurantIdFromKioskToken(current) === rid) return current;
  const token = newKioskToken(rid);
  tables.setToken(table.id, token);
  return token;
}

/** This PC's private-network IPv4 address (only meaningful for the local single-PC deployment). */
function lanIp() {
  const candidates = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address)) candidates.push(net.address);
    }
  }
  return candidates.find(ip => ip.startsWith('192.168.')) || candidates.find(ip => ip.startsWith('10.')) || candidates[0] || null;
}

module.exports = { requireTable, ensureToken, lanIp };
