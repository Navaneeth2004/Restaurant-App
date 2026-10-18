'use strict';
/** Suite: orders: additive + concurrency */
module.exports = async (t) => {
  const { A, B, check, S } = t;
  let r;

  console.log('\n[orders: additive + concurrency]');
  r = await A.get('/api/tables');
  check('8 default tables', r.data.length === 8, r.data.length);
  r = await A.get('/api/menu');
  const wings = r.data.find(m => m.name === 'Crispy Wings'), fries = r.data.find(m => m.name === 'Loaded Fries');
  S.wings = wings; S.fries = fries;
  const results = await Promise.all([
    A.post('/api/orders', { table_id: 'T1', items: [{ menu_item_id: wings.id, name: wings.name, price: wings.price, quantity: 2 }] }),
    A.post('/api/orders', { table_id: 'T1', items: [{ menu_item_id: fries.id, name: fries.name, price: fries.price, quantity: 3 }] }),
    A.post('/api/orders', { table_id: 'T1', items: [{ menu_item_id: wings.id, name: wings.name, price: wings.price, quantity: 1 }] }),
  ]);
  check('3 concurrent submits all succeed', results.every(x => x.status === 200 || x.status === 201), results.map(x => x.status));
  r = await A.get('/api/orders/table/T1');
  const qty = (n) => (r.data.items.find(i => i.name === n) || {}).quantity;
  check('quantities merged, nothing lost', qty('Crispy Wings') === 3 && qty('Loaded Fries') === 3, r.data.items);
  check('total correct', Math.abs(r.data.total - (3 * wings.price + 3 * fries.price)) < 0.001, r.data.total);
  const order1 = r.data; S.order1 = order1;
  r = await A.post('/api/orders', { table_id: 'T1', items: [{ menu_item_id: wings.id, name: 'x', price: -5, quantity: 1 }] });
  check('negative price refused', r.status === 400);
  r = await A.post('/api/orders', { table_id: 'T1', items: [{ menu_item_id: wings.id, name: 'x', price: 1, quantity: 0 }] });
  check('zero quantity refused', r.status === 400);
  r = await A.post('/api/orders', { table_id: 'NOPE', items: [{ menu_item_id: wings.id, name: 'x', price: 1, quantity: 1 }] });
  check('unknown table -> 404', r.status === 404);
  r = await B.post('/api/orders', { table_id: 'T1', items: [{ menu_item_id: wings.id, name: 'x', price: 1, quantity: 1 }] });
  check('kitchen cannot create orders', r.status === 403);
};
