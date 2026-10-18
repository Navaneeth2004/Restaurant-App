'use strict';
/** Baseline tenant tables (migration 001). Never edit: add a new migration instead. */
module.exports = `
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
`;
