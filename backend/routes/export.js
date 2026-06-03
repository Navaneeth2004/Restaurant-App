const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ── MENU EXPORT ──────────────────────────────────────────────────────────────
// GET /api/export/menu  — returns full menu as JSON
router.get('/menu', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const items      = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM menu_items m JOIN categories c ON m.category_id = c.id
    ORDER BY c.sort_order, m.name
  `).all();

  const payload = {
    exported_at: new Date().toISOString(),
    version: 1,
    categories: categories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order })),
    items: items.map(i => ({
      name:          i.name,
      description:   i.description,
      price:         i.price,
      category_name: i.category_name,  // used for re-mapping on import
      available:     i.available,
      // Note: image_path is local — not exported
    })),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="menu_export_${new Date().toISOString().split('T')[0]}.json"`);
  res.json(payload);
});

// POST /api/export/menu/import  — import menu from JSON
router.post('/menu/import', express.json({ limit: '2mb' }), (req, res) => {
  const { categories, items } = req.body;
  if (!categories || !items) return res.status(400).json({ error: 'Invalid export file' });

  const results = { categories_added: 0, items_added: 0, items_skipped: 0 };

  const doImport = db.transaction(() => {
    // Build a map of category name -> id (existing + newly created)
    const catMap = {};
    const existingCats = db.prepare('SELECT id, name FROM categories').all();
    existingCats.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    // Add missing categories
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m ?? 0;
    const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    categories.forEach((c, i) => {
      const key = c.name.toLowerCase();
      if (!catMap[key]) {
        const info = insertCat.run(c.name, maxOrder + i + 1);
        catMap[key] = info.lastInsertRowid;
        results.categories_added++;
      }
    });

    // Add items (skip if exact name+category combo already exists)
    const insertItem = db.prepare('INSERT INTO menu_items (name, description, price, category_id, available) VALUES (?, ?, ?, ?, ?)');
    const checkItem  = db.prepare('SELECT id FROM menu_items WHERE LOWER(name) = ? AND category_id = ?');

    items.forEach(item => {
      const catId = catMap[item.category_name?.toLowerCase()];
      if (!catId) { results.items_skipped++; return; }
      const exists = checkItem.get(item.name.toLowerCase(), catId);
      if (exists) { results.items_skipped++; return; }
      insertItem.run(item.name, item.description || '', parseFloat(item.price), catId, item.available ? 1 : 0);
      results.items_added++;
    });
  });

  doImport();
  req.io.emit('menu_updated');
  req.io.emit('categories_updated');
  res.json({ success: true, ...results });
});

// ── REVENUE EXPORT ───────────────────────────────────────────────────────────
// GET /api/export/revenue?from=2026-01-01&to=2026-06-04&format=json|csv
router.get('/revenue', (req, res) => {
  const { from, to, format = 'json' } = req.query;

  const today = new Date().toISOString().split('T')[0];
  const dateFrom = from || '2020-01-01';
  const dateTo   = to   || today;

  // Orders in range
  const orders = db.prepare(`
    SELECT o.*, t.label as table_label
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('delivered','closed')
      AND substr(o.created_at,1,10) >= ? AND substr(o.created_at,1,10) <= ?
    ORDER BY o.created_at ASC
  `).all(dateFrom, dateTo);

  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  });

  // Daily breakdown
  const dailyMap = {};
  orders.forEach(o => {
    const day = o.created_at.split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, orders: 0, items_sold: 0 };
    dailyMap[day].revenue    += o.total;
    dailyMap[day].orders     += 1;
    dailyMap[day].items_sold += o.items.reduce((s, i) => s + i.quantity, 0);
  });
  const daily = Object.values(dailyMap);

  // Item breakdown
  const itemMap = {};
  orders.forEach(o => {
    o.items.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty_sold: 0, revenue: 0 };
      itemMap[i.name].qty_sold += i.quantity;
      itemMap[i.name].revenue  += i.price * i.quantity;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);

  // Summary
  const totalRevenue   = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders    = orders.length;
  const totalItemsSold = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const settings = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const currency   = settingsMap.currency_symbol || '₹';
  const taxPct     = parseFloat(settingsMap.tax_percent || '5') / 100;
  const taxCollected  = totalRevenue - (totalRevenue / (1 + taxPct));
  const revenueExTax  = totalRevenue - taxCollected;

  if (format === 'csv') {
    // Build CSV
    const lines = [];
    lines.push(`Revenue Report — ${settingsMap.restaurant_name || 'Restaurant'}`);
    lines.push(`Period: ${dateFrom} to ${dateTo}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Total Revenue,${currency}${totalRevenue.toFixed(2)}`);
    lines.push(`Revenue (ex. tax),${currency}${revenueExTax.toFixed(2)}`);
    lines.push(`Tax Collected (${settingsMap.tax_percent || 5}%),${currency}${taxCollected.toFixed(2)}`);
    lines.push(`Total Orders,${totalOrders}`);
    lines.push(`Total Items Sold,${totalItemsSold}`);
    lines.push(`Average Order Value,${currency}${avgOrderValue.toFixed(2)}`);
    lines.push('');
    lines.push('DAILY BREAKDOWN');
    lines.push('Date,Revenue,Orders,Items Sold');
    daily.forEach(d => lines.push(`${d.date},${currency}${d.revenue.toFixed(2)},${d.orders},${d.items_sold}`));
    lines.push('');
    lines.push('ITEMS SOLD');
    lines.push('Item,Qty Sold,Revenue');
    topItems.forEach(i => lines.push(`"${i.name}",${i.qty_sold},${currency}${i.revenue.toFixed(2)}`));
    lines.push('');
    lines.push('ORDER DETAIL');
    lines.push('Date,Time,Table,Items,Total,Status');
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const itemsStr = o.items.map(i => `${i.quantity}x ${i.name}`).join(' | ');
      lines.push(`${d.toLocaleDateString()},${d.toLocaleTimeString()},"${o.table_label||o.table_id}","${itemsStr}",${currency}${o.total.toFixed(2)},${o.status}`);
    });

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_${dateFrom}_to_${dateTo}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  } else {
    // JSON
    const payload = {
      generated_at: new Date().toISOString(),
      restaurant:   settingsMap.restaurant_name,
      period:       { from: dateFrom, to: dateTo },
      summary: {
        total_revenue:    parseFloat(totalRevenue.toFixed(2)),
        revenue_ex_tax:   parseFloat(revenueExTax.toFixed(2)),
        tax_collected:    parseFloat(taxCollected.toFixed(2)),
        tax_percent:      parseFloat(settingsMap.tax_percent || '5'),
        total_orders:     totalOrders,
        total_items_sold: totalItemsSold,
        avg_order_value:  parseFloat(avgOrderValue.toFixed(2)),
        currency,
      },
      daily_breakdown: daily,
      top_items:       topItems,
      orders: orders.map(o => ({
        id:         o.id,
        table:      o.table_label || o.table_id,
        created_at: o.created_at,
        status:     o.status,
        total:      o.total,
        items:      o.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price, subtotal: parseFloat((i.price * i.quantity).toFixed(2)) })),
      })),
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_${dateFrom}_to_${dateTo}.json"`);
    res.json(payload);
  }
});

module.exports = router;
