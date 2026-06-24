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
 * Full factory reset — wipes everything and returns the app to a clean slate:
 *
 * DELETED:
 *   - All orders and order items
 *   - All tables (recreated as defaults)
 *   - All menu items and categories (recreated as defaults)
 *   - All uploaded images (item photos + logo)
 *   - All staff sessions
 *
 * RESET TO DEFAULTS:
 *   - Restaurant settings (name, address, phone, footer, tax, color, currency, logo)
 *   - GST settings (gstin, legal_name, state_name, sac_code, b2b_enabled)
 *   - Kitchen overdue threshold
 *   - Admin lock config
 *
 * KEPT:
 *   - Staff accounts and PINs (so you can still log in)
 */
router.post('/', (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'RESET EVERYTHING') {
    return res.status(400).json({ error: 'Confirmation phrase incorrect' });
  }

  try {
    const wipe = db.transaction(() => {
      // ── Orders ───────────────────────────────────────────────────────
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();

      // ── Staff sessions (force everyone to log in fresh) ───────────────
      try { db.prepare('DELETE FROM staff_sessions').run(); } catch (_) {}

      // ── Tables — delete all, recreate 8 defaults ──────────────────────
      db.prepare('DELETE FROM tables').run();
      for (let i = 1; i <= 8; i++) {
        db.prepare(
          'INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)'
        ).run(`T${i}`, `Table ${i}`, i <= 4 ? 4 : 6, i);
      }

      // ── Menu items and categories — delete all, recreate defaults ─────
      db.prepare('DELETE FROM menu_items').run();
      db.prepare('DELETE FROM categories').run();

      // Re-seed categories
      const defaultCategories = ['Starters', 'Mains', 'Sides', 'Drinks', 'Desserts'];
      defaultCategories.forEach((name, i) => {
        db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, i);
      });

      // Re-seed menu items
      const cats = db.prepare('SELECT id, name FROM categories').all();
      const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));
      [
        ['Crispy Wings',    'Fried chicken wings with house sauce',  8.99,  'Starters'],
        ['Chicken Strips',  'Golden fried chicken strips',           7.49,  'Starters'],
        ['Loaded Fries',    'Fries with cheese and jalapeños',       5.99,  'Starters'],
        ['Grilled Chicken', 'Half grilled chicken with herbs',       13.99, 'Mains'  ],
        ['Chicken Burger',  'Crispy fillet with lettuce and mayo',   11.99, 'Mains'  ],
        ['Spicy Sandwich',  'Spicy chicken fillet sandwich',         10.49, 'Mains'  ],
        ['Coleslaw',        'House-made creamy coleslaw',            2.99,  'Sides'  ],
        ['Garlic Bread',    'Toasted garlic bread',                  3.49,  'Sides'  ],
        ['Cola',            '330ml can',                             2.49,  'Drinks' ],
        ['Lemonade',        'Fresh squeezed lemonade',               2.99,  'Drinks' ],
        ['Water',           'Still or sparkling 500ml',              1.49,  'Drinks' ],
        ['Chocolate Cake',  'Warm chocolate fudge cake',             5.49,  'Desserts'],
        ['Ice Cream',       'Two scoops of vanilla ice cream',       3.99,  'Desserts'],
      ].forEach(([name, desc, price, cat]) => {
        db.prepare(
          'INSERT INTO menu_items (name, description, price, category_id, available) VALUES (?, ?, ?, ?, 1)'
        ).run(name, desc, price, catMap[cat]);
      });

      // ── Settings — reset everything to factory defaults ───────────────
      const settingsToReset = {
        restaurant_name:      'ABC Restaurant',
        address:              '123 Main Street, City',
        phone:                '+91 98765 43210',
        bill_footer:          'Thank you for dining with us!',
        tax_percent:          '5',
        brand_color:          '#f97316',
        currency_symbol:      '₹',
        logo_url:             '',
        kitchen_overdue_mins: '20',
        // GST details
        gstin:                '',
        legal_name:           '',
        state_name:           'Kerala',
        sac_code:             '9963',
        b2b_enabled:          'false',
        // Admin lock
        admin_lock_config:    JSON.stringify({ enabled: false, timeout_mins: 5 }),
      };

      for (const [key, value] of Object.entries(settingsToReset)) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
      }
    });

    wipe();

    // ── Remove ALL uploaded images ─────────────────────────────────────
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        try { fs.unlinkSync(path.join(uploadsDir, file)); } catch (_) {}
      }
    }

    // ── Notify all clients ─────────────────────────────────────────────
    req.io.emit('tables_updated');
    req.io.emit('menu_updated');
    req.io.emit('categories_updated');
    req.io.emit('settings_updated', {
      restaurant_name: 'ABC Restaurant',
      brand_color:     '#f97316',
      logo_url:        '',
      tax_percent:     '5',
      currency_symbol: '₹',
      kitchen_overdue_mins: '20',
      admin_lock_config: JSON.stringify({ enabled: false, timeout_mins: 5 }),
    });

    console.log('[Reset] Full factory reset performed.');
    res.json({
      success: true,
      message: 'Factory reset complete. All orders, history, images, menu, tables, and settings have been reset to defaults. Staff accounts were kept.'
    });
  } catch (err) {
    console.error('[Reset] Error:', err.message);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

module.exports = router;