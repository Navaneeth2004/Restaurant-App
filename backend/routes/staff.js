const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const staff = db.prepare('SELECT id, name, role, active FROM staff ORDER BY name').all();
  res.json(staff);
});

router.post('/', (req, res) => {
  const { name, pin, role } = req.body;
  if (!name || !pin || !role) return res.status(400).json({ error: 'name, pin, role required' });
  const info = db.prepare('INSERT INTO staff (name, pin, role) VALUES (?, ?, ?)').run(name.trim(), pin, role);
  const staff = db.prepare('SELECT id, name, role, active FROM staff WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(staff);
});

router.put('/:id', (req, res) => {
  const { name, pin, role, active } = req.body;
  db.prepare('UPDATE staff SET name = COALESCE(?, name), pin = COALESCE(?, pin), role = COALESCE(?, role), active = COALESCE(?, active) WHERE id = ?')
    .run(name || null, pin || null, role || null, active !== undefined ? (active ? 1 : 0) : null, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST verify PIN for login
router.post('/verify', (req, res) => {
  const { pin } = req.body;
  const staff = db.prepare('SELECT id, name, role FROM staff WHERE pin = ? AND active = 1').get(pin);
  if (!staff) return res.status(401).json({ error: 'Invalid PIN' });
  res.json(staff);
});

module.exports = router;
