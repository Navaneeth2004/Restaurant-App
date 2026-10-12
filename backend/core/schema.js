'use strict';

const bcrypt = require('bcryptjs');

const DEFAULT_SETTINGS = [
  ['restaurant_name', 'ABC Restaurant'],
  ['address', '123 Main Street, City'],
  ['phone', '+91 98765 43210'],
  ['bill_footer', 'Thank you for dining with us!'],
  ['tax_percent', '5'],
  ['brand_color', '#f97316'],
  ['currency_symbol', '₹'],
  ['logo_url', ''],
  ['kitchen_overdue_mins', '20'],
  ['gstin', ''],
  ['legal_name', ''],
  ['state_name', 'Kerala'],
  ['sac_code', '9963'],
  ['b2b_enabled', 'false'],
  ['admin_lock_config', JSON.stringify({ enabled: false, timeout_mins: 5 })],
];

const DEFAULT_CATEGORIES = ['Starters', 'Mains', 'Sides', 'Drinks', 'Desserts'];
const DEFAULT_ITEMS = [
  ['Crispy Wings', 'Fried chicken wings with house sauce', 8.99, 'Starters'],
  ['Chicken Strips', 'Golden fried chicken strips', 7.49, 'Starters'],
  ['Loaded Fries', 'Fries with cheese and jalapeños', 5.99, 'Starters'],
  ['Grilled Chicken', 'Half grilled chicken with herbs', 13.99, 'Mains'],
  ['Chicken Burger', 'Crispy fillet with lettuce and mayo', 11.99, 'Mains'],
  ['Spicy Sandwich', 'Spicy chicken fillet sandwich', 10.49, 'Mains'],
  ['Coleslaw', 'House-made creamy coleslaw', 2.99, 'Sides'],
  ['Garlic Bread', 'Toasted garlic bread', 3.49, 'Sides'],
  ['Cola', '330ml can', 2.49, 'Drinks'],
  ['Lemonade', 'Fresh squeezed lemonade', 2.99, 'Drinks'],
  ['Water', 'Still or sparkling 500ml', 1.49, 'Drinks'],
  ['Chocolate Cake', 'Warm chocolate fudge cake', 5.49, 'Desserts'],
  ['Ice Cream', 'Two scoops of vanilla ice cream', 3.99, 'Desserts'],
];

function columns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name));
}

function ensureColumn(db, table, name, declaration) {
  if (!columns(db, table).has(name)) db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${declaration}`);
}

function initialize(db, options = {}) {
  const seedDefaults = options.seedDefaults !== false;
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      category_id INTEGER NOT NULL,
      image_path TEXT DEFAULT NULL,
      available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      seats INTEGER DEFAULT 4,
      status TEXT DEFAULT 'empty' CHECK(status IN ('empty','occupied','waiting_bill')),
      sort_order INTEGER DEFAULT 0,
      session_id TEXT DEFAULT NULL,
      kiosk_token TEXT DEFAULT NULL,
      is_parcel INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      customer_name TEXT DEFAULT NULL,
      customer_phone TEXT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','delivered','closed')),
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      delivered_at TEXT DEFAULT NULL,
      total REAL DEFAULT 0,
      payment_method TEXT DEFAULT NULL,
      payment_details TEXT DEFAULT NULL,
      change_amount REAL DEFAULT 0,
      customer_name TEXT DEFAULT NULL,
      customer_phone TEXT DEFAULT NULL,
      session_id TEXT DEFAULT NULL,
      amount_paid REAL DEFAULT NULL,
      order_type TEXT DEFAULT 'dine_in',
      customer_gstin TEXT DEFAULT NULL,
      tax_percent_snapshot REAL DEFAULT NULL,
      edited_at TEXT DEFAULT NULL,
      FOREIGN KEY (table_id) REFERENCES tables(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      note TEXT DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','waiter','kitchen')),
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS staff_sessions (
      staff_id INTEGER PRIMARY KEY,
      token TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
    CREATE TABLE IF NOT EXISTS deleted_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deleted_at TEXT NOT NULL,
      deleted_by TEXT,
      table_id TEXT,
      table_label TEXT,
      visit_at TEXT,
      order_count INTEGER DEFAULT 1,
      subtotal REAL DEFAULT 0,
      bill_total REAL DEFAULT 0,
      amount_paid REAL,
      payment_method TEXT,
      order_type TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_gstin TEXT,
      was_edited INTEGER DEFAULT 0,
      edited_at TEXT,
      items_json TEXT
    );
  `);

  const additions = {
    menu_items: [
      ['sort_order', 'INTEGER DEFAULT 0'],
    ],
    tables: [
      ['session_id', 'TEXT DEFAULT NULL'],
      ['kiosk_token', 'TEXT DEFAULT NULL'],
      ['is_parcel', 'INTEGER DEFAULT 0'],
      ['is_archived', 'INTEGER DEFAULT 0'],
      ['customer_name', 'TEXT DEFAULT NULL'],
      ['customer_phone', 'TEXT DEFAULT NULL'],
    ],
    orders: [
      ['payment_method', 'TEXT DEFAULT NULL'],
      ['payment_details', 'TEXT DEFAULT NULL'],
      ['change_amount', 'REAL DEFAULT 0'],
      ['customer_name', 'TEXT DEFAULT NULL'],
      ['customer_phone', 'TEXT DEFAULT NULL'],
      ['session_id', 'TEXT DEFAULT NULL'],
      ['amount_paid', 'REAL DEFAULT NULL'],
      ['order_type', "TEXT DEFAULT 'dine_in'"],
      ['customer_gstin', 'TEXT DEFAULT NULL'],
      ['tax_percent_snapshot', 'REAL DEFAULT NULL'],
      ['edited_at', 'TEXT DEFAULT NULL'],
    ],
  };
  for (const [table, definitions] of Object.entries(additions)) {
    for (const [name, declaration] of definitions) ensureColumn(db, table, name, declaration);
  }
  db.exec("UPDATE tables SET is_parcel = 1 WHERE id GLOB 'P[0-9]*' AND is_parcel = 0");

  const setSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const row of DEFAULT_SETTINGS) setSetting.run(...row);
  if (options.restaurantName) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('restaurant_name', ?)")
      .run(String(options.restaurantName).slice(0, 60));
  }

  if (seedDefaults && !db.prepare('SELECT COUNT(*) AS c FROM categories').get().c) {
    const insert = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    DEFAULT_CATEGORIES.forEach((name, index) => insert.run(name, index));
  }
  if (seedDefaults && !db.prepare('SELECT COUNT(*) AS c FROM tables').get().c) {
    const insert = db.prepare('INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)');
    for (let i = 1; i <= 8; i++) insert.run(`T${i}`, `Table ${i}`, i <= 4 ? 4 : 6, i);
  }
  if (seedDefaults && !db.prepare('SELECT COUNT(*) AS c FROM menu_items').get().c) {
    const categoryIds = Object.fromEntries(
      db.prepare('SELECT id, name FROM categories').all().map(row => [row.name, row.id])
    );
    const insert = db.prepare(
      'INSERT INTO menu_items (name, description, price, category_id, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    DEFAULT_ITEMS.forEach(([name, description, price, category], index) =>
      insert.run(name, description, price, categoryIds[category], index + 1)
    );
  }
  const unpositioned = db.prepare(
    'SELECT id, category_id FROM menu_items WHERE sort_order = 0 ORDER BY category_id, id'
  ).all();
  if (unpositioned.length) {
    const maxima = Object.fromEntries(
      db.prepare('SELECT category_id, MAX(sort_order) AS max_order FROM menu_items GROUP BY category_id')
        .all().map(row => [row.category_id, row.max_order || 0])
    );
    const updateOrder = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
    const seed = db.transaction(() => {
      for (const item of unpositioned) {
        maxima[item.category_id] = (maxima[item.category_id] || 0) + 1;
        updateOrder.run(maxima[item.category_id], item.id);
      }
    });
    seed();
  }

  // Legacy installations stored PINs in plain text; upgrade them in place.
  const staff = db.prepare('SELECT id, pin FROM staff').all();
  const updatePin = db.prepare('UPDATE staff SET pin = ? WHERE id = ?');
  for (const member of staff) {
    if (!/^\$2[aby]\$/.test(String(member.pin))) {
      updatePin.run(bcrypt.hashSync(String(member.pin), 10), member.id);
    }
  }

  if (options.adminPinHash && !db.prepare('SELECT 1 FROM staff LIMIT 1').get()) {
    db.prepare('INSERT INTO staff (name, pin, role, active) VALUES (?, ?, ?, 1)')
      .run(String(options.adminName).trim().slice(0, 40), options.adminPinHash, 'admin');
  } else if (options.admin && !db.prepare('SELECT 1 FROM staff LIMIT 1').get()) {
    db.prepare('INSERT INTO staff (name, pin, role, active) VALUES (?, ?, ?, 1)')
      .run(String(options.admin.name).trim().slice(0, 40), bcrypt.hashSync(String(options.admin.pin), 10), 'admin');
  }
}

function migrate(db) {
  return initialize(db, { seedDefaults: false });
}

function seedNewRestaurant(db, options) {
  return initialize(db, { ...options, seedDefaults: true });
}

module.exports = { initialize, migrate, seedDefaults: seedNewRestaurant };
