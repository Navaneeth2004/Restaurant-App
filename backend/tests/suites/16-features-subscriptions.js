'use strict';
/** Suite: subscriptions, per-restaurant overrides and global feature switches */
module.exports = async (t) => {
  const { A, anon, base, check, Client, S, tz } = t;
  let r;

  console.log('\n[subscriptions & feature switches]');
  const R = new Client(base);
  r = await R.post('/api/root/login', { phone: '9999900000', password: 'rootpassword1' });
  check('root login', r.status === 200, r);
  r = await R.get('/api/root/restaurants');
  const rid = r.data.find(x => x.name === 'Test Diner').id;
  const restaurant = `/api/root/restaurants/${rid}`;
  const gstr9 = `/api/export/gst/gstr9${tz}`;
  const gstr3b = `/api/export/gst/gstr3b${tz}`;

  r = await R.get('/api/root/features');
  check('catalog lists every switchable feature', r.status === 200 && r.data.features.some(f => f.key === 'export.gstr9') && Array.isArray(r.data.switches), r.data);
  r = await R.get('/api/root/subscriptions');
  check('built-in subscriptions exist', r.status === 200 && ['trial', 'standard', 'premium'].every(s => r.data.some(x => x.slug === s)), r.data);

  r = await R.post('/api/root/subscriptions', { name: 'Lite', disabled: ['export.gstr9', 'reports.deleted'], limits: { max_tables: 20 } });
  check('create subscription', r.status === 201 && r.data.slug === 'lite' && r.data.restaurants === 0 && r.data.limits.max_tables === 20, r);
  r = await R.post('/api/root/subscriptions', { name: 'Lite' });
  check('duplicate subscription -> 409', r.status === 409, r);
  r = await R.post('/api/root/subscriptions', { name: 'Bad', disabled: ['nope'] });
  check('unknown feature refused', r.status === 400, r);
  r = await R.post('/api/root/subscriptions', { name: '  ' });
  check('subscription needs a name', r.status === 400, r);

  r = await R.patch(restaurant, { plan: 'lite' });
  check('restaurant moved to the subscription', r.status === 200 && r.data.plan === 'lite', r.data);
  r = await A.get(gstr9);
  check('feature off in the subscription -> 403 feature_disabled', r.status === 403 && r.data.code === 'feature_disabled' && r.data.feature === 'export.gstr9', r);
  r = await A.get('/api/orders/log/deleted');
  check('second feature of the subscription is off too', r.status === 403 && r.data.code === 'feature_disabled', r);
  r = await A.get(gstr3b);
  check('features the subscription keeps still work', r.status === 200, r);
  r = await A.get('/api/auth/features');
  check('the device is told what is off', r.status === 200 && 'export.gstr9' in r.data.disabled && !('export.gstr3b' in r.data.disabled), r.data);

  r = await R.put('/api/root/subscriptions/lite', { name: 'Lite', disabled: ['export.gstr9'], limits: {} });
  check('editing a subscription applies at once', r.status === 200, r);
  r = await A.get('/api/orders/log/deleted');
  check('feature switched back on in the subscription', r.status === 200, r);

  r = await R.patch(restaurant, { features: { 'export.gstr9': true } });
  check('restaurant override stored', r.status === 200 && r.data.feature_overrides['export.gstr9'] === true && r.data.features_effective['export.gstr9'].on === true, r.data);
  r = await A.get(gstr9);
  check('override beats the subscription', r.status === 200, r);
  r = await R.patch(restaurant, { features: { 'not.a.feature': false } });
  check('override of an unknown feature refused', r.status === 400, r);

  r = await R.put('/api/root/features/export.gstr3b', { off: true, message: 'GSTR-3B is being fixed' });
  check('global switch off', r.status === 200, r);
  r = await A.get(gstr3b);
  check('global switch blocks the restaurant with root\'s message', r.status === 403 && r.data.error === 'GSTR-3B is being fixed' && r.data.code === 'feature_disabled', r);
  r = await R.patch(restaurant, { features: { 'export.gstr3b': true } });
  r = await A.get(gstr3b);
  check('global switch beats a restaurant override', r.status === 403, r);
  r = await R.put('/api/root/features/export.gstr3b', { off: false });
  r = await A.get(gstr3b);
  check('global switch back on', r.status === 200, r);

  r = await R.patch(restaurant, { features: { kiosk: false } });
  r = await anon.get(`/api/kiosk/${S.token}`);
  check('customer QR ordering can be switched off', r.status === 403 && r.data.code === 'feature_disabled', r);
  r = await A.post('/api/kiosk/ensure-token', { table_id: 'T1' });
  check('QR helper for staff is switched off too', r.status === 403, r);

  r = await R.patch(restaurant, { features: {} });
  r = await anon.get(`/api/kiosk/${S.token}`);
  check('QR ordering back on (the page itself answers again)', r.status !== 403, r);
  r = await A.post('/api/staff/verify', { pin: '4826' });
  check('PIN login is never switchable', r.status === 200, r);

  r = await R.del('/api/root/subscriptions/lite');
  check('a subscription in use cannot be deleted', r.status === 409, r);
  r = await R.patch(restaurant, { plan: 'standard' });
  r = await R.del('/api/root/subscriptions/trial');
  check('the built-in trial subscription cannot be deleted', r.status === 400, r);
  r = await R.del('/api/root/subscriptions/lite');
  check('an unused subscription can be deleted', r.status === 200, r);
  r = await R.patch(restaurant, { plan: 'lite' });
  check('moving to a deleted subscription refused', r.status === 400, r);
  r = await R.get('/api/root/audit');
  check('every change is in the audit log', ['subscription.create', 'subscription.update', 'subscription.delete', 'feature.switch_off'].every(a => r.data.some(x => x.action === a)), r.data.map(x => x.action));
};
