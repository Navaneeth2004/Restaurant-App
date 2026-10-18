'use strict';
/** Suite: auth & devices */
module.exports = async (t) => {
  const { A, anon, check, S } = t;
  let r;

  console.log('\n[auth & devices]');
  r = await A.post('/api/auth/owner/register', { phone: '98765 43210', password: 'password123', restaurant_name: 'Test Diner', admin_name: 'Boss', admin_pin: '4826' });
  check('register -> 201 linked', r.status === 201 && r.data.linked, r);
  r = await A.get('/api/auth/device/status');
  check('device status linked', r.data.linked && r.data.restaurant.name === 'Test Diner', r.data);
  r = await anon.post('/api/auth/owner/register', { phone: '9876543210', password: 'password123', restaurant_name: 'X', admin_name: 'Y', admin_pin: '4826' });
  check('duplicate phone (same number, other format) -> 409', r.status === 409, r);
  r = await anon.post('/api/auth/owner/login', { phone: '+91 98765-43210', password: 'wrong-pass' });
  check('wrong password -> 401', r.status === 401);
  r = await anon.get('/api/tables');
  check('unlinked device -> 401 device_required', r.status === 401 && r.data.code === 'device_required');
  r = await A.get('/api/tables');
  check('linked but no PIN -> 401 staff_required', r.status === 401 && r.data.code === 'staff_required');
  r = await A.post('/api/staff/verify', { pin: '0000' });
  check('wrong PIN -> 401', r.status === 401);
  r = await A.post('/api/staff/verify', { pin: '4826' });
  check('admin PIN login', r.status === 200 && r.data.role === 'admin', r);
  const adminSession = r.data; S.adminSession = adminSession;
  r = await A.get(`/api/staff/session/validate?staffId=${adminSession.id}&sessionToken=${adminSession.sessionToken}`);
  check('heartbeat valid', r.data.valid === true);
};
