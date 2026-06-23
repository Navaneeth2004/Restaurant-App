/**
 * database.js — SQLite via sql.js (pure JavaScript, zero compilation)
 *
 * Drop-in replacement for better-sqlite3.
 * Works on Node.js v18, v20, v22 — any version, no C++ build tools needed.
 *
 * API mirrors better-sqlite3 (synchronous):
 *   db.prepare(sql).get(...params)
 *   db.prepare(sql).all(...params)
 *   db.prepare(sql).run(...params)
 *   db.exec(sql)
 *   db.pragma(str)
 *   db.transaction(fn)
 *
 * Call `await db.init()` once in server.js before app.listen().
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const DB_PATH = path.join(dataDir, 'restaurant.db');

// ── Internal state ────────────────────────────────────────────────────────
let _raw           = null;   // sql.js Database instance
let _inTransaction = false;  // prevents save() during transactions

// ── Save helper ───────────────────────────────────────────────────────────
function save() {
  if (_inTransaction) return;
  const data = _raw.export();
  const tmp  = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, DB_PATH);
}

// ── Row helper ────────────────────────────────────────────────────────────
function execToRows(results) {
  if (!results || !results.length) return [];
  const { columns, values } = results[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// ── Param helper ──────────────────────────────────────────────────────────
/**
 * Normalise variadic args into what sql.js expects:
 *   .get(1, 2, 3)  → [1, 2, 3]
 *   .get([1, 2])   → [1, 2]
 *   .get({a: 1})   → {a: 1}   (named params)
 *   .get(null)     → [null]
 *
 * Also sanitises undefined → null because sql.js throws on undefined values.
 */
function flatParams(args) {
  let params;
  if (args.length === 0) {
    params = [];
  } else if (args.length === 1) {
    const a = args[0];
    if (a === null || a === undefined) {
      params = [null];
    } else if (Array.isArray(a)) {
      params = a;
    } else if (typeof a === 'object') {
      params = a; // named params object
    } else {
      params = [a];
    }
  } else {
    params = Array.from(args);
  }

  // Sanitise: sql.js throws on undefined values — convert to null
  if (Array.isArray(params)) {
    return params.map(p => (p === undefined ? null : p));
  }
  // Named params object
  if (params && typeof params === 'object') {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, v === undefined ? null : v])
    );
  }
  return params;
}

// ── Statement wrapper ─────────────────────────────────────────────────────
class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  /** Returns first matching row as a plain object, or undefined. */
  get(...args) {
    const p = flatParams(args);
    return execToRows(_raw.exec(this._sql, p))[0];
  }

  /** Returns all matching rows as an array of plain objects. */
  all(...args) {
    const p = flatParams(args);
    return execToRows(_raw.exec(this._sql, p));
  }

  /**
   * Executes a write statement.
   * Returns { changes, lastInsertRowid } matching better-sqlite3.
   */
  run(...args) {
    const p = flatParams(args);
    _raw.run(this._sql, p);
    const changes         = _raw.getRowsModified();
    const lastInsertRowid = execToRows(_raw.exec('SELECT last_insert_rowid() as id'))[0]?.id;
    save();
    return { changes, lastInsertRowid };
  }
}

// ── Public db object ──────────────────────────────────────────────────────
const db = {
  prepare(sql) {
    return new Statement(sql);
  },

  exec(sql) {
    _raw.run(sql);
    save();
    return db;
  },

  pragma(str) {
    // WAL mode and foreign_keys don't apply to sql.js — silently ignore them
    try {
      if (!/journal_mode|foreign_keys/i.test(str)) _raw.run(`PRAGMA ${str}`);
    } catch (_) { /* ignore */ }
  },

  transaction(fn) {
    return function (...args) {
      _inTransaction = true;
      _raw.run('BEGIN');
      try {
        const result = fn(...args);
        _raw.run('COMMIT');
        _inTransaction = false;
        save();
        return result;
      } catch (e) {
        _inTransaction = false;
        try { _raw.run('ROLLBACK'); } catch (_) {}
        throw e;
      }
    };
  },

  /**
   * Initialises sql.js and loads or creates the database file.
   * Must be awaited once in server.js before app.listen().
   */
  async init() {
    const initSqlJs = require('sql.js/dist/sql-asm.js');
    const SQL       = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      _raw = new SQL.Database(fs.readFileSync(DB_PATH));
      console.log('[DB] Loaded existing database from', DB_PATH);
    } else {
      _raw = new SQL.Database();
      console.log('[DB] Created new database at', DB_PATH);
    }

    _initSchema();
    console.log('[DB] Ready');
  },
};

// ── Schema + seed data ────────────────────────────────────────────────────
function _initSchema() {
  _raw.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  _raw.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    )
  `);

  _raw.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      price       REAL    NOT NULL,
      category_id INTEGER NOT NULL,
      image_path  TEXT    DEFAULT NULL,
      available   INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // sort_order is included in schema so tables.js migration block is not needed
  _raw.run(`
    CREATE TABLE IF NOT EXISTS tables (
      id         TEXT    PRIMARY KEY,
      label      TEXT    NOT NULL,
      seats      INTEGER DEFAULT 4,
      status     TEXT    DEFAULT 'empty'
                         CHECK(status IN ('empty','occupied','waiting_bill')),
      sort_order INTEGER DEFAULT 0,
      session_id TEXT    DEFAULT NULL
    )
  `);

  // Migration: add session_id to tables if it doesn't exist yet
  try {
    _raw.run(`ALTER TABLE tables ADD COLUMN session_id TEXT DEFAULT NULL`);
    console.log('[DB] Migrated tables: added session_id column');
  } catch (_) { /* column already exists — safe to ignore */ }

_raw.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id               TEXT    PRIMARY KEY,
      table_id         TEXT    NOT NULL,
      status           TEXT    DEFAULT 'active'
                               CHECK(status IN ('active','delivered','closed')),
      created_at       TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      delivered_at     TEXT    DEFAULT NULL,
      total            REAL    DEFAULT 0,
      payment_method   TEXT    DEFAULT NULL,
      payment_details  TEXT    DEFAULT NULL,
      change_amount    REAL    DEFAULT 0,
      customer_name    TEXT    DEFAULT NULL,
      customer_phone   TEXT    DEFAULT NULL,
      session_id       TEXT    DEFAULT NULL,
      amount_paid      REAL    DEFAULT NULL,
      order_type       TEXT    DEFAULT 'dine_in',
      customer_gstin   TEXT    DEFAULT NULL,
      FOREIGN KEY (table_id) REFERENCES tables(id)
    )
  `);

  // Migration: add payment and session columns to orders if they don't exist yet
  try {
    _raw.run(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL`);
    console.log('[DB] Migrated orders: added payment_method column');
  } catch (_) {}
  try {
    _raw.run(`ALTER TABLE orders ADD COLUMN payment_details TEXT DEFAULT NULL`);
    console.log('[DB] Migrated orders: added payment_details column');
  } catch (_) {}
  try {
    _raw.run(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`);
    console.log('[DB] Migrated orders: added change_amount column');
  } catch (_) {}
  try {
    _raw.run(`ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT NULL`);
    console.log('[DB] Migrated orders: added customer_name column');
  } catch (_) {}
  try {
    _raw.run(`ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL`);
    console.log('[DB] Migrated orders: added customer_phone column');
  } catch (_) {}
  try {
    _raw.run(`ALTER TABLE orders ADD COLUMN session_id TEXT DEFAULT NULL`);
    console.log('[DB] Migrated orders: added session_id column');
  } catch (_) { /* column already exists — safe to ignore */ }

  _raw.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     TEXT    NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name         TEXT    NOT NULL,
      price        REAL    NOT NULL,
      quantity     INTEGER NOT NULL DEFAULT 1,
      note         TEXT    DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  _raw.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT    NOT NULL,
      pin    TEXT    NOT NULL,
      role   TEXT    NOT NULL CHECK(role IN ('admin','waiter','kitchen')),
      active INTEGER DEFAULT 1
    )
  `);

  // Seed settings (INSERT OR IGNORE = skip if already set)
  const pairs = [
    ['restaurant_name', 'ABC Restaurant'],
    ['address',         '123 Main Street, City'],
    ['phone',           '+91 98765 43210'],
    ['bill_footer',     'Thank you for dining with us!'],
    ['tax_percent',     '5'],
    ['brand_color',     '#f97316'],
    ['currency_symbol', '₹'],
    ['logo_url',        ''],
  ];
  for (const [k, v] of pairs) {
    _raw.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }

  // Seed categories
  if (!execToRows(_raw.exec('SELECT COUNT(*) as c FROM categories'))[0]?.c) {
    ['Starters', 'Mains', 'Sides', 'Drinks', 'Desserts'].forEach((n, i) => {
      _raw.run('INSERT INTO categories (name, sort_order) VALUES (?, ?)', [n, i]);
    });
  }

  // Seed tables
  if (!execToRows(_raw.exec('SELECT COUNT(*) as c FROM tables'))[0]?.c) {
    for (let i = 1; i <= 8; i++) {
      _raw.run(
        'INSERT INTO tables (id, label, seats, sort_order) VALUES (?, ?, ?, ?)',
        [`T${i}`, `Table ${i}`, i <= 4 ? 4 : 6, i]
      );
    }
  }

  // Seed menu items
  if (!execToRows(_raw.exec('SELECT COUNT(*) as c FROM menu_items'))[0]?.c) {
    const cats   = execToRows(_raw.exec('SELECT id, name FROM categories'));
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
    ].forEach(([n, d, p, cat]) => {
      _raw.run(
        'INSERT INTO menu_items (name, description, price, category_id) VALUES (?, ?, ?, ?)',
        [n, d, p, catMap[cat]]
      );
    });
  }

  _raw.run(`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      staff_id   INTEGER PRIMARY KEY,
      token      TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    )
  `);

  // Seed staff
  if (!execToRows(_raw.exec('SELECT COUNT(*) as c FROM staff'))[0]?.c) {
    _raw.run("INSERT INTO staff (name, pin, role) VALUES ('Admin',    '0000', 'admin')");
    _raw.run("INSERT INTO staff (name, pin, role) VALUES ('Waiter 1', '1111', 'waiter')");
    _raw.run("INSERT INTO staff (name, pin, role) VALUES ('Kitchen',  '2222', 'kitchen')");
  }

  save();
}

module.exports = db;