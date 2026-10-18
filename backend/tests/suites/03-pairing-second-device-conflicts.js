'use strict';
/** Suite: pairing second device + conflicts */
module.exports = async (t) => {
  const { A, B, anon, base, check, Client } = t;
  let r;

  console.log('\n[pairing second device + conflicts]');
  r = await A.post('/api/auth/pairing-code', { role_lock: 'kitchen' });
  check('pairing code', r.status === 200 && /^\d{6}$/.test(r.data.code), r);
  const code = r.data.code;
  r = await B.post('/api/auth/device/pair', { code });
  check('pair device B', r.status === 200 && r.data.linked, r);
  r = await anon.post('/api/auth/device/pair', { code });
  check('code is single-use', r.status === 400);
  r = await B.post('/api/staff/verify', { pin: '5937' });
  check('role-locked (kitchen) device refuses waiter', r.status === 403, r);
  r = await B.post('/api/staff/verify', { pin: '7351' });
  check('kitchen login on kitchen tablet', r.status === 200 && r.data.role === 'kitchen');
  r = await B.get('/api/orders/active');
  check('kitchen can read active orders', r.status === 200 && Array.isArray(r.data));
  r = await B.get('/api/menu');
  check('kitchen cannot read menu (403)', r.status === 403);
  r = await B.get('/api/staff/session/validate?staffId=0&sessionToken=x');
  check('kitchen may call heartbeat (was blocked before)', r.status === 200);
  r = await B.get('/api/settings');
  check('kitchen can read settings', r.status === 200 && r.data.restaurant_name === 'Test Diner');
  // same staff (waiter) on a different device while the first is live
  const C = new Client(base);
  await C.post('/api/auth/owner/login', { phone: '9876543210', password: 'password123' });
  r = await A.post('/api/staff/verify', { pin: '5937' });          // A (admin tablet) logs in as waiter -> new session for waiter, replaces admin cookie
  check('waiter login on device A', r.status === 200, r);
  const waiterSession = r.data;
  r = await C.post('/api/staff/verify', { pin: '5937' });
  check('same waiter on another device while live -> 409', r.status === 409, r);
  r = await A.post('/api/staff/verify', { pin: '5937', currentSessionToken: waiterSession.sessionToken });
  check('same device may log in again', r.status === 200, r);
  r = await A.post('/api/staff/verify', { pin: '4826' });
  check('admin back on A', r.status === 200 && r.data.role === 'admin');
};
