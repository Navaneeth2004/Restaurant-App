'use strict';
/** Suite: staff accounts */
module.exports = async (t) => {
  const { A, check, S } = t;
  const { adminSession } = S;
  let r;

  console.log('\n[staff accounts]');
  r = await A.post('/api/staff', { name: 'Wally', pin: '5937', role: 'waiter' });
  check('create waiter', r.status === 201, r);
  
  r = await A.post('/api/staff', { name: 'Kit', pin: '7351', role: 'kitchen' });
  check('create kitchen', r.status === 201);
  r = await A.post('/api/staff', { name: 'Weak', pin: '1111', role: 'waiter' });
  check('weak PIN refused', r.status === 400);
  r = await A.post('/api/staff', { name: 'Dup', pin: '5937', role: 'waiter' });
  check('duplicate PIN refused', r.status === 409);
  r = await A.put(`/api/staff/${adminSession.id}`, { active: false });
  check('cannot deactivate last admin', r.status === 400, r.data);
  r = await A.put(`/api/staff/${adminSession.id}`, { role: 'waiter' });
  check('cannot demote last admin', r.status === 400);
  r = await A.del(`/api/staff/${adminSession.id}`);
  check('cannot delete last admin', r.status === 400);
};
