'use strict';

/**
 * backend/routes/parcel.js
 *
 * FIX: Migration no longer runs as an IIFE at module load time.
 * It runs lazily on the first request, by which point the DB is
 * guaranteed to be ready. This fixes:
 *   TypeError: Cannot read properties of null (reading 'exec')
 *
 * How to call the migration from server.js (add after DB is confirmed ready):
 *   require('./routes/parcel').runMigration();
 * Or just leave it lazy — it auto-runs on the first parcel API call.
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// db is required lazily inside functions so it's always initialized by then
function getDb() {
  return require('../db/database');
}

// ── Migration — runs once, lazily ────────────────────────────────────────
let _migrated = false;

function runMigration() {
  if (_migrated) return;
  const db = getDb();
  try {
    const cols = db.prepare('PRAGMA table_info(tables)').all().map(c => c.name);
    if (!cols.includes('is_parcel')) {
      db.exec('ALTER TABLE tables ADD COLUMN is_parcel INTEGER DEFAULT 0');
      console.log('[Parcel] Migration: added is_parcel column');
    }
    if (!cols.includes('is_archived')) {
      db.exec('ALTER TABLE tables ADD COLUMN is_archived INTEGER DEFAULT 0');
      console.log('[Parcel] Migration: added is_archived column');
      // Mark any slots already created with P-style ids
      db.exec("UPDATE tables SET is_parcel = 1 WHERE id GLOB 'P[0-9]*'");
    }
    _migrated = true;
  } catch (err) {
    console.error('[Parcel] Migration error:', err.message);
  }
}

// Middleware that ensures migration has run before any parcel route executes
function ensureMigrated(req, res, next) {
  runMigration();
  next();
}

router.use(ensureMigrated);

// ── Helper ────────────────────────────────────────────────────────────────
function nextParcelId() {
  const db = getDb();
  // Search across active AND archived so IDs never collide
  const existing = db.prepare(
    "SELECT id FROM tables WHERE id GLOB 'P[0-9]*'"
  ).all().map(r => r.id);

  for (let n = 1; n <= 999; n++) {
    if (!existing.includes(`P${n}`)) return `P${n}`;
  }
  return `P${Date.now()}`;
}

// ── POST /api/parcel/slot ─────────────────────────────────────────────────
router.post('/slot', (req, res) => {
  const db = getDb();
  const { customer_name } = req.body || {};

  try {
    const id    = nextParcelId();
    const num   = id.slice(1);
    const label = customer_name?.trim()
      ? customer_name.trim()          // just "Syria", not "Parcel — Syria"
      : `Parcel ${num}`;

    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as m FROM tables'
    ).get()?.m ?? 0;

    db.prepare(
      'INSERT INTO tables (id, label, seats, status, sort_order, is_parcel, is_archived) VALUES (?, ?, ?, ?, ?, 1, 0)'
    ).run(id, label, 0, 'empty', maxOrder + 1);

    const token = crypto.randomBytes(24).toString('base64url');
    db.prepare('UPDATE tables SET kiosk_token = ? WHERE id = ?').run(token, id);

    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(id);

    req.io.emit('tables_updated');
    res.status(201).json({ ...table, kiosk_token: token });
  } catch (err) {
    console.error('[Parcel] Create slot error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create parcel slot' });
  }
});

// ── GET /api/parcel/slots ─────────────────────────────────────────────────
router.get('/slots', (req, res) => {
  const db = getDb();
  const slots = db.prepare(
    'SELECT * FROM tables WHERE is_parcel = 1 AND is_archived = 0 ORDER BY sort_order, id'
  ).all();
  res.json(slots);
});

// ── DELETE /api/parcel/slot/:id ───────────────────────────────────────────
// Soft-delete: mark archived so the table row — and all linked orders —
// remain in the DB. Reports, history, and analytics continue to work.
router.delete('/slot/:id', (req, res) => {
  const db  = getDb();
  const { id } = req.params;

  if (!/^P\d+$/.test(id)) {
    return res.status(400).json({ error: 'Not a parcel slot' });
  }

  const open = db.prepare(
    "SELECT COUNT(*) as c FROM orders WHERE table_id = ? AND status IN ('active','delivered')"
  ).get(id)?.c || 0;

  if (open > 0) {
    return res.status(400).json({
      error: 'Cannot remove — this parcel has open orders. Close the bill first.',
    });
  }

  db.prepare(
    "UPDATE tables SET is_archived = 1, status = 'empty' WHERE id = ?"
  ).run(id);

  req.io.emit('tables_updated');
  res.json({ success: true });
});

module.exports = router;
module.exports.runMigration = runMigration;