'use strict';
/** Suite: parcel */
module.exports = async (t) => {
  const { A, anon, check, S } = t;
  const { wings } = S;
  let r;

  console.log('\n[parcel]');
  r = await A.post('/api/parcel/slot', { customer_name: 'Sam' });
  check('parcel slot', r.status === 201 && r.data.id === 'P1' && r.data.kiosk_token, r);
  r = await anon.get(`/api/kiosk/${r.data.kiosk_token}`);
  check('parcel QR works', r.status === 200 && r.data.is_parcel === true);
  r = await A.post('/api/orders', { table_id: 'P1', items: [{ menu_item_id: wings.id, name: wings.name, price: wings.price, quantity: 1 }] });
  check('staff order on parcel is order_type parcel', r.status === 201, r);
  r = await A.get('/api/orders/table/P1');
  check('order_type = parcel', r.data.order_type === 'parcel', r.data.order_type);
  r = await A.del('/api/parcel/slot/P1');
  check('cannot remove parcel with open orders', r.status === 400);
};
