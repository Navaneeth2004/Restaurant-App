'use strict';
/** Suite: backup / restore / reset */
module.exports = async (t) => {
  const { A, check } = t;
  let r;

  console.log('\n[backup / restore / reset]');
  r = await A.get('/api/backup/download');
  check('backup zip', r.status === 200 && Buffer.isBuffer(r.data) && r.data.length > 1000);
  const backup = r.data;
  const fdr = new FormData();
  fdr.append('backup', new Blob([backup], { type: 'application/zip' }), 'b.zip');
  r = await A.call('POST', '/api/backup/restore', fdr);
  check('restore', r.status === 200 && r.data.success, r);
  r = await A.get('/api/tables');
  check('after restore everyone must log in again', r.status === 401);
  r = await A.post('/api/staff/verify', { pin: '4826' });
  check('login works after restore', r.status === 200);
  r = await A.post('/api/reset', { confirm: 'nope' });
  check('reset needs the phrase', r.status === 400);
  r = await A.post('/api/reset', { confirm: 'RESET EVERYTHING' });
  check('factory reset', r.status === 200, r);
  r = await A.post('/api/staff/verify', { pin: '4826' });
  r = await A.get('/api/tables');
  check('reset recreates 8 default tables', r.data.length === 8, r.data.length);
};
