'use strict';
/** Suite: regression tests for the security/logic review fixes */
module.exports = async (t) => {
  const { base, check, Client, anon, S } = t;
  let r;

  console.log('\n[review fixes]');

  // GST: the tax split always adds up to the tax that is charged
  const { splitGst, withTax } = require('../../src/lib/money');
  const s = splitGst(10.1, 5);
  check('GST split adds up to the charged tax', s.tax === 0.51 && Math.round((s.cgst + s.sgst) * 100) === 51 && withTax(10.1, 5) === 10.61, s);

  // a menu item to work with (admin session left by suite 17)
  const C = S.C;
  r = await C.post('/api/categories', { name: 'Fixes' });
  const fd = new FormData();
  fd.append('name', 'Fix item'); fd.append('price', '10'); fd.append('category_id', String(r.data.id));
  const item = (await C.call('POST', '/api/menu', fd)).data;
  check('menu item created', item && item.id > 0, item);
  const line = { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 };

  // a waiter on a new device
  const W = new Client(base);
  await W.post('/api/auth/owner/login', { phone: '9876543210', password: 'password123' });
  r = await W.post('/api/staff/verify', { pin: '5937' });
  check('waiter login on a new device', r.status === 200, r);

  r = await W.post('/api/orders', { table_id: 'T6', items: [{ ...line, price: 0.01 }] });
  check('a price that differs from the menu is refused', r.status === 400, r);
  r = await W.post('/api/orders', { table_id: 'T6', items: [line], request_id: 'req-12345678' });
  check('order with a request id', r.status === 201, r);
  r = await W.post('/api/orders', { table_id: 'T6', items: [line], request_id: 'req-12345678' });
  check('the same request id is not applied twice', r.status === 200, r);
  r = await W.get('/api/orders/table/T6');
  check('quantity is still 1', r.data.items.length === 1 && r.data.items[0].quantity === 1, r.data);

  // kiosk: the visit id is mandatory once a visit exists, and asking for the bill does not drop kitchen rounds
  r = await W.post('/api/kiosk/ensure-token', { table_id: 'T7' });
  const token = r.data.token;
  r = await anon.post(`/api/kiosk/${token}/order`, { items: [{ menu_item_id: item.id, quantity: 1 }] });
  check('kiosk first order on a free table', r.status === 201, r);
  const sid = r.data.session_id;
  r = await anon.post(`/api/kiosk/${token}/order`, { items: [{ menu_item_id: item.id, quantity: 1 }] });
  check('kiosk order without the visit id is refused', r.status === 409, r);
  r = await anon.post(`/api/kiosk/${token}/order`, { items: [{ menu_item_id: item.id, quantity: 1 }], client_session_id: sid });
  check('kiosk order with the visit id', r.status === 200, r);
  r = await anon.post(`/api/kiosk/${token}/bill`, { client_session_id: sid });
  check('kiosk bill request', r.status === 200, r);
  r = await W.get('/api/orders/active');
  check('the kitchen still sees the round after a bill request', r.data.some(o => o.table_id === 'T7' && o.status === 'active'), r.data);

  // closing: a bill built from other rounds is refused, a bad method is refused, a good close works
  r = await W.post('/api/orders', { table_id: 'T8', items: [line] });
  const oid = r.data.id;
  r = await W.patch(`/api/orders/${oid}/close`, { payment_method: 'cash', order_ids: ['not-this-one'] });
  check('close with a changed set of rounds -> 409', r.status === 409 && r.data.code === 'order_changed', r);
  r = await W.patch(`/api/orders/${oid}/close`, { payment_method: 'bitcoin' });
  check('unknown payment method refused', r.status === 400, r);
  r = await W.patch(`/api/orders/${oid}/close`, { payment_method: 'cash', order_ids: [oid] });
  check('close with the right rounds', r.status === 200 && r.data.success, r);

  // PIN lockout (shared budget, 5 wrong PINs then locked)
  const L = new Client(base);
  await L.post('/api/auth/owner/login', { phone: '9876543210', password: 'password123' });
  for (let i = 0; i < 5; i++) await L.post('/api/staff/verify', { pin: '0001' });
  r = await L.post('/api/staff/verify', { pin: '0001' });
  check('five wrong PINs lock the device', r.status === 429, r);
  r = await L.post('/api/staff/check-pin', { pin: '0001' });
  check('the admin-PIN check shares the same lock', r.status === 429, r);
};
