'use strict';
/**
 * POST /api/reset   Body: { confirm: "RESET EVERYTHING" }   (admin only)
 *
 * Wipes THIS restaurant only:
 *   deleted: orders, order items, deleted-records log, tables (re-created: 6 defaults),
 *            menu items, categories (re-created: 5 defaults, empty), staff sessions, photos + logo
 *   reset to defaults: tax / colour / currency / GST / kitchen threshold / admin lock
 *   kept: staff accounts and PINs, restaurant name, other restaurants
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const files = require('../core/files');

router.post('/', (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'RESET EVERYTHING') return res.status(400).json({ error: 'Confirmation phrase incorrect' });

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare('DELETE FROM deleted_records').run();
      db.prepare('DELETE FROM staff_sessions').run();

      db.prepare('DELETE FROM tables').run();
      for (let i = 1; i <= 6; i++) {
        db.prepare('INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)')
          .run(`T${i}`, `Table ${i}`, i <= 3 ? 4 : 6, i);
      }

      db.prepare('DELETE FROM menu_items').run();
      db.prepare('DELETE FROM categories').run();
      ['Starters', 'Mains', 'Sides', 'Drinks', 'Desserts'].forEach((name, i) => {
        db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, i);
      });

      const defaults = {
        address: '', phone: '', bill_footer: 'Thank you for dining with us!',
        tax_percent: '5', brand_color: '#f97316', currency_symbol: '₹', logo_url: '',
        kitchen_overdue_mins: '20',
        gstin: '', legal_name: '', state_name: 'Kerala', sac_code: '9963', b2b_enabled: 'false',
        admin_lock_config: JSON.stringify({ enabled: false, timeout_mins: 5 }),
      };
      for (const [k, v] of Object.entries(defaults)) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, v);
      }
    })();

    files.clearUploads(req.restaurantId);

    req.io.emit('tables_updated');
    req.io.emit('menu_updated');
    req.io.emit('categories_updated');
    req.io.emit('settings_updated', {
      brand_color: '#f97316', logo_url: '', tax_percent: '5', currency_symbol: '₹', kitchen_overdue_mins: '20',
      admin_lock_config: JSON.stringify({ enabled: false, timeout_mins: 5 }),
    });

    console.log(`[Reset] Factory reset performed for restaurant ${req.restaurantId}`);
    res.json({
      success: true,
      message: 'Factory reset complete. Orders, history, photos, menu, tables and settings were reset. Staff accounts were kept.',
    });
  } catch (err) {
    console.error('[Reset] Error:', err.message);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

module.exports = router;