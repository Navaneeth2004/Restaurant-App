'use strict';
/** Suite: reports & GST */
module.exports = async (t) => {
  const { A, tz, check } = t;
  let r;

  console.log('\n[reports & GST]');
  r = await A.get(`/api/reports/today${tz}`);
  check('today: 3 visits', r.status === 200 && r.data.ordersCount === 3, r.data);
  const methods = Object.fromEntries(r.data.paymentBreakdown.map(p => [p.payment_method, p.count]));
  check('payment breakdown counts visits, no "null" bucket', methods.upi === 1 && methods.cash === 1 && methods.card === 1 && !('null' in methods), methods);
  r = await A.get(`/api/reports/history${tz}`);
  check('history rows have items', r.data.length >= 4 && r.data.every(o => Array.isArray(o.items)), r.data.length);
  r = await A.get(`/api/reports/revenue${tz}`);
  check('revenue chart', r.status === 200 && r.data.length >= 1);
  r = await A.get(`/api/export/gst/gstr1/preview${tz}`);
  check('GSTR-1 preview: 3 bills, 1 B2B', r.status === 200 && r.data.order_count === 3 && r.data.b2b.invoice_count === 1 && r.data.b2cs.invoice_count === 2, r.data);
  r = await A.get(`/api/export/gst/gstr1${tz}`);
  const inv = r.data.b2b[0] && r.data.b2b[0].inv[0];
  check('GSTR-1 JSON: short invoice number', inv && inv.inum.length <= 16 && /^INV-/.test(inv.inum), inv);
  r = await A.get(`/api/export/gst/gstr3b${tz}`);
  check('GSTR-3B', r.status === 200 && r.data.intrastate_b2b.invoice_count === 1 && r.data.order_count === 3, r.data);
  r = await A.get(`/api/export/gst/gstr9${tz}`);
  check('GSTR-9', r.status === 200 && r.data.session_count === 3 && r.data.order_count === 4, r.data);
  r = await A.get(`/api/export/revenue${tz}&format=csv`);
  check('revenue CSV', r.status === 200 && /ORDER DETAIL/.test(r.data), String(r.data).slice(0, 80));
  r = await A.get(`/api/export/revenue${tz}`);
  check('revenue JSON: 3 bills', r.status === 200 && r.data.summary.total_orders === 3, r.data.summary);
  r = await A.post('/api/staff/verify', { pin: '5937' });   // become waiter
  r = await A.get('/api/reports/today');
  check('waiter cannot read reports', r.status === 403);
  r = await A.get('/api/export/gst/gstr3b');
  check('waiter cannot export', r.status === 403);
  r = await A.post('/api/staff/verify', { pin: '4826' });
};
