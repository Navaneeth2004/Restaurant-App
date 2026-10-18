'use strict';
/** Suite: kiosk (customer QR) */
module.exports = async (t) => {
  const { A, anon, check, S } = t;
  const { wings } = S;
  let r;

  console.log('\n[kiosk (customer QR)]');
  r = await A.post('/api/kiosk/ensure-token', { table_id: 'T2' });
  check('ensure-token', r.status === 200 && r.data.token.length > 20, r);
  const token = r.data.token; S.token = token;
  r = await anon.get(`/api/kiosk/${token}`);
  check('QR token resolves to table (was broken before)', r.status === 200 && r.data.table_id === 'T2', r);
  r = await anon.get('/api/kiosk/deadbeef00' + 'x'.repeat(30));
  check('bad token -> 404', r.status === 404);
  r = await anon.get(`/api/kiosk/${token}/menu`);
  check('kiosk menu', r.status === 200 && r.data.items.length === 13);
  r = await anon.post(`/api/kiosk/${token}/order`, { items: [{ menu_item_id: wings.id, name: 'Free wings', price: 0, quantity: 2 }] });
  check('kiosk order created', r.status === 201, r);
  check('kiosk price comes from the menu, not the client', r.data.items[0].price === wings.price && r.data.items[0].name === 'Crispy Wings', r.data.items);
  r = await anon.post(`/api/kiosk/${token}/order`, { items: [{ menu_item_id: 999999, quantity: 1 }] });
  check('kiosk unknown item refused', r.status === 400);
  r = await anon.post(`/api/kiosk/${token}/bill`, {});
  check('kiosk bill request', r.status === 200);
  r = await anon.get('/api/tables');
  check('anon still blocked from staff API', r.status === 401);
};
