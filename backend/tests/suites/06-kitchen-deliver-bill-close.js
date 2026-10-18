'use strict';
/** Suite: kitchen deliver, bill, close */
module.exports = async (t) => {
  const { A, B, check, S } = t;
  const { wings, fries, order1 } = S;
  let r;

  console.log('\n[kitchen deliver, bill, close]');
  r = await B.patch(`/api/orders/${order1.id}/deliver`);
  check('kitchen delivers', r.status === 200 && r.data.status === 'delivered', r);
  r = await A.patch(`/api/orders/${order1.id}/close`, { payment_method: 'upi', customer_gstin: '32ABCDE1234F1Z5', amount_paid: 100 });
  check('close table T1', r.status === 200 && r.data.success, r);
  r = await A.get('/api/tables');
  check('T1 empty again', r.data.find(t => t.id === 'T1').status === 'empty');
  r = await A.patch(`/api/orders/${order1.id}/close`, { payment_method: 'cash' });
  check('closing twice is harmless', r.status === 200 && /already/.test(r.data.note || ''), r.data);

  // second visit with two rounds -> one bill
  await A.post('/api/orders', { table_id: 'T3', items: [{ menu_item_id: wings.id, name: wings.name, price: wings.price, quantity: 1 }] });
  r = await A.get('/api/orders/table/T3'); const t3 = r.data;
  await A.patch(`/api/orders/${t3.id}/deliver`);
  await A.post('/api/orders', { table_id: 'T3', items: [{ menu_item_id: fries.id, name: fries.name, price: fries.price, quantity: 1 }] });
  r = await A.get('/api/orders/table/T3/all');
  check('two rounds in one session', r.data.length === 2 && r.data[0].session_id === r.data[1].session_id, r.data.length);
  await A.patch(`/api/orders/${r.data[1].id}/close`, { payment_method: 'cash' });

  r = await A.post('/api/orders/direct-bill', { table_id: 'T4', items: [{ menu_item_id: fries.id, name: fries.name, price: fries.price, quantity: 2 }] });
  check('direct bill', r.status === 201 && r.data.status === 'delivered');
  await A.patch(`/api/orders/${r.data.id}/close`, { payment_method: 'card', order_type: 'dine_in' });
};
