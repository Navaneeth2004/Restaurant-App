'use strict';

/**
 * backend/routes/parcel.js
 *
 * Table schema and migrations are initialized for each restaurant database
 * by core/schema.js before this router handles requests.
 */

const express = require('express');
const router  = express.Router();
const generateToken = require('../core/kiosk-token');

// db is required lazily inside functions so it's always initialized by then
function getDb() {
  return require('../db/database');
}

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
  const { customer_name, customer_phone } = req.body || {};

  try {
    const id    = nextParcelId();
    const num   = id.slice(1);
    const label = customer_name?.trim()
      ? customer_name.trim()          // just "Syria", not "Parcel — Syria"
      : `Parcel ${num}`;

    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as m FROM tables'
    ).get()?.m ?? 0;

    // FIX: persist customer_name/customer_phone as real columns (not just
    // folded into label) so the Bill screen can auto-fill them later.
    db.prepare(
      'INSERT INTO tables (id, label, seats, status, sort_order, is_parcel, is_archived, customer_name, customer_phone) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)'
    ).run(id, label, 0, 'empty', maxOrder + 1, customer_name?.trim() || null, customer_phone?.trim() || null);

    const token = generateToken();
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