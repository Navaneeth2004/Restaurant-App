'use strict';
/** Suite: restaurant activity in the audit log (paging, search), subscription info, removing a device ends its PIN session */
module.exports = async (t) => {
  const { A, base, check, Client } = t;
  let r;

  console.log('\n[audit, subscription info, device removal]');
  r = await A.get('/api/auth/subscription');
  check('admin sees the subscription and the plans', r.status === 200 && typeof r.data.plan.slug === 'string' && r.data.plans.length >= 3, r.data);

  const C = new Client(base);
  await C.post('/api/auth/owner/login', { phone: '9876543210', password: 'password123' });
  r = await C.get('/api/auth/subscription');
  check('a device without a PIN session cannot read it', r.status === 401, r);
  r = await C.post('/api/staff/verify', { pin: '4826' });
  check('same admin on another device while live -> 409', r.status === 409, r);

  r = await A.get('/api/auth/devices');
  const mine = r.data.find(d => d.is_current);
  r = await A.del(`/api/auth/devices/${mine.id}`);
  check('remove this device', r.status === 200, r);
  r = await C.post('/api/staff/verify', { pin: '4826' });
  check('removing a device ends its PIN session, so login works elsewhere', r.status === 200, r);

  const R = new Client(base);
  await R.post('/api/root/login', { phone: '9999900000', password: 'rootpassword1' });
  r = await R.get('/api/root/audit?source=app&limit=500');
  const actions = r.data.map(x => x.action);
  check('restaurant activity reaches the audit log',
    ['app.owner.login', 'app.staff.login', 'app.staff.login_failed', 'app.device.remove'].every(a => actions.includes(a)), actions);
  check('source=app hides root actions', actions.every(a => a.startsWith('app.')));
  r = await R.get('/api/root/audit?q=device.remove');
  check('search narrows the log', r.data.length >= 1 && r.data.every(x => x.action.includes('device.remove')), r.data);
  r = await R.get('/api/root/audit?limit=1&offset=0');
  const first = r.data[0];
  r = await R.get('/api/root/audit?limit=1&offset=1');
  check('paging moves to the next entry', r.data.length === 1 && r.data[0].id !== first.id, r.data);
};