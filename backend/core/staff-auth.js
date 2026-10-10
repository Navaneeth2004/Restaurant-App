'use strict';

const db = require('../db/database');
const { STAFF_COOKIE, parseCookies } = require('./devices');

function resolveStaff(value) {
  const match = /^(\d+)\.([a-f0-9]+)$/i.exec(String(value || ''));
  if (!match) return null;
  const id = Number(match[1]);
  const token = match[2];
  const session = db.prepare('SELECT token FROM staff_sessions WHERE staff_id = ?').get(id);
  if (!session || session.token !== token) return null;
  const staff = db.prepare('SELECT id, name, role, active FROM staff WHERE id = ?').get(id);
  return staff && staff.active ? staff : null;
}

function fromRequest(req) {
  return resolveStaff(parseCookies(req.headers.cookie)[STAFF_COOKIE]);
}

module.exports = { resolveStaff, fromRequest };
