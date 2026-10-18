'use strict';
/** Suite: cancel flows */
module.exports = async (t) => {
  const { A, check } = t;
  let r;

  console.log('\n[cancel flows]');
  r = await A.get('/api/orders/table/P1'); const p1 = r.data;
  r = await A.patch(`/api/orders/${p1.id}/cancel-item`, { item_id: p1.items[0].id });
  check('cancel last item cancels the order', r.status === 200, r);
  r = await A.get('/api/tables');
  check('parcel table freed', r.data.find(t => t.id === 'P1').status === 'empty');
};
