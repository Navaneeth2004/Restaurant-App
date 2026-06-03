const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'restaurant.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
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
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      seats INTEGER DEFAULT 4,
      status TEXT DEFAULT 'empty' CHECK(status IN ('empty','occupied','waiting_bill'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','delivered','closed')),
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      delivered_at TEXT DEFAULT NULL,
      total REAL DEFAULT 0,
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
  `);

  const ins = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  [
    ['restaurant_name', 'ABC Restaurant'],
    ['address',         '123 Main Street, City'],
    ['phone',           '+91 98765 43210'],
    ['bill_footer',     'Thank you for dining with us!'],
    ['tax_percent',     '5'],
    ['brand_color',     '#f97316'],
    ['currency_symbol', '₹'],
    ['logo_url',        ''],
  ].forEach(([k,v]) => ins.run(k,v));

  if (!db.prepare('SELECT COUNT(*) as c FROM categories').get().c) {
    const ic = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    ['Starters','Mains','Sides','Drinks','Desserts'].forEach((n,i) => ic.run(n,i));
  }

  if (!db.prepare('SELECT COUNT(*) as c FROM tables').get().c) {
    const it = db.prepare('INSERT INTO tables (id, label, seats) VALUES (?, ?, ?)');
    for (let i = 1; i <= 8; i++) it.run(`T${i}`, `Table ${i}`, i <= 4 ? 4 : 6);
  }

  if (!db.prepare('SELECT COUNT(*) as c FROM menu_items').get().c) {
    const cats = Object.fromEntries(db.prepare('SELECT id, name FROM categories').all().map(c => [c.name, c.id]));
    const im = db.prepare('INSERT INTO menu_items (name, description, price, category_id) VALUES (?, ?, ?, ?)');
    [
      ['Crispy Wings',    'Fried chicken wings with house sauce',   8.99,  'Starters'],
      ['Chicken Strips',  'Golden fried chicken strips',            7.49,  'Starters'],
      ['Loaded Fries',    'Fries with cheese and jalapeños',        5.99,  'Starters'],
      ['Grilled Chicken', 'Half grilled chicken with herbs',        13.99, 'Mains'],
      ['Chicken Burger',  'Crispy fillet with lettuce and mayo',    11.99, 'Mains'],
      ['Spicy Sandwich',  'Spicy chicken fillet sandwich',          10.49, 'Mains'],
      ['Coleslaw',        'House-made creamy coleslaw',             2.99,  'Sides'],
      ['Garlic Bread',    'Toasted garlic bread',                   3.49,  'Sides'],
      ['Cola',            '330ml can',                              2.49,  'Drinks'],
      ['Lemonade',        'Fresh squeezed lemonade',                2.99,  'Drinks'],
      ['Water',           'Still or sparkling 500ml',               1.49,  'Drinks'],
      ['Chocolate Cake',  'Warm chocolate fudge cake',              5.49,  'Desserts'],
      ['Ice Cream',       'Two scoops of vanilla ice cream',        3.99,  'Desserts'],
    ].forEach(([n,d,p,c]) => im.run(n,d,p,cats[c]));
  }

  if (!db.prepare('SELECT COUNT(*) as c FROM staff').get().c) {
    const is_ = db.prepare('INSERT INTO staff (name, pin, role) VALUES (?, ?, ?)');
    is_.run('Admin',    '0000', 'admin');
    is_.run('Waiter 1', '1111', 'waiter');
    is_.run('Kitchen',  '2222', 'kitchen');
  }
}

initDb();
module.exports = db;
