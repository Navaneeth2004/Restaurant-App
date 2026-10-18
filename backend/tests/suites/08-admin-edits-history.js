'use strict';
/** Suite: admin edits & history */
module.exports = async (t) => {
  const { A, check } = t;
  let r;

  console.log('\n[admin edits & history]');
  r = await A.get('/api/orders/history');
  const closedUpi = r.data.find(o => o.payment_method === 'upi');
  r = await A.patch(`/api/orders/${closedUpi.id}/payment`, { payment_method: 'cash', amount_paid: 50 });
  check('edit payment', r.status === 200 && r.data.success, r);
  r = await A.post('/api/orders/delete-records', { order_ids: [closedUpi.id], pin: 'wrong' });
  check('delete history needs admin PIN', r.status === 403);
  r = await A.post('/api/orders/delete-records', { order_ids: [closedUpi.id], pin: '4826' });
  check('delete closed visit', r.status === 200 && r.data.deleted_ids.length === 1, r);
  r = await A.get('/api/orders/log/deleted');
  check('audit log keeps a copy', r.data.length === 1 && r.data[0].items.length === 2, r.data);
};
