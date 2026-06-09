const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const revenue = db.prepare(`
    SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count
    FROM orders
    WHERE status IN ('delivered','closed') AND substr(created_at,1,10) = ?
  `).get(today);

  const activeOrders   = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status='active'").get();
  const occupiedTables = db.prepare("SELECT COUNT(*) as count FROM tables WHERE status != 'empty'").get();

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as total_qty, SUM(oi.price*oi.quantity) as total_rev
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status IN ('delivered','closed') AND substr(o.created_at,1,10) = ?
    GROUP BY oi.name
    ORDER BY total_qty DESC
    LIMIT 5
  `).all(today);

  // Payment method breakdown for today
  const paymentBreakdown = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total) as total
    FROM orders
    WHERE status = 'closed' AND substr(created_at,1,10) = ?
    GROUP BY payment_method
  `).all(today);

  res.json({ revenue: revenue.total, ordersCount: revenue.count, activeOrders: activeOrders.count, occupiedTables: occupiedTables.count, topItems, paymentBreakdown });
});

router.get('/history', (req, res) => {
  const { from, to, limit = 200 } = req.query;
  let q = "SELECT * FROM orders WHERE status IN ('delivered','closed')";
  const p = [];
  if (from) { q += " AND substr(created_at,1,10) >= ?"; p.push(from); }
  if (to)   { q += " AND substr(created_at,1,10) <= ?"; p.push(to); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  p.push(parseInt(limit));
  const orders = db.prepare(q).all(...p);
  orders.forEach(o => { o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id); });
  res.json(orders);
});

router.get('/revenue', (req, res) => {
  const rows = db.prepare(`
    SELECT substr(created_at,1,10) as day, SUM(total) as revenue, COUNT(*) as orders
    FROM orders
    WHERE status IN ('delivered','closed')
      AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')
    GROUP BY day
    ORDER BY day ASC
  `).all();
  res.json(rows);
});

module.exports = router;