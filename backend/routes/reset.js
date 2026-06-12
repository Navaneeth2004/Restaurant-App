'use strict';

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const db      = require('../db/database');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

/**
 * POST /api/reset
 * Body: { confirm: "RESET EVERYTHING" }
 *
 * Deletes all orders and order_items, resets tables to empty,
 * removes all uploaded images (item photos + logo), and clears
 * the logo_url setting. Staff, menu, categories and settings
 * are left untouched.
 *
 * This route is intentionally not documented anywhere visible —
 * it is only surfaced inside the Admin > Backup tab behind
 * multiple confirmation steps.
 */
router.post('/', (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'RESET EVERYTHING') {
    return res.status(400).json({ error: 'Confirmation phrase incorrect' });
  }

  try {
    const wipe = db.transaction(() => {
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare("UPDATE tables SET status = 'empty'").run();
    });
    wipe();

    // Remove uploaded images
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.startsWith('item_') || file.startsWith('logo_')) {
          try { fs.unlinkSync(path.join(uploadsDir, file)); } catch (_) {}
        }
      }
    }

    // Clear image paths from menu items and logo from settings
    db.prepare('UPDATE menu_items SET image_path = NULL').run();
    db.prepare("UPDATE settings SET value = '' WHERE key = 'logo_url'").run();

    // Notify all clients
    req.io.emit('tables_updated');
    req.io.emit('menu_updated');
    req.io.emit('settings_updated', { logo_url: '' });

    console.log('[Reset] Factory reset performed.');
    res.json({ success: true, message: 'Reset complete. All orders, history and images have been wiped.' });
  } catch (err) {
    console.error('[Reset] Error:', err.message);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

module.exports = router;