'use strict';
/** Suite: misc */
module.exports = async (t) => {
  const { A, check } = t;
  let r;

  console.log('\n[misc]');
  r = await A.get('/api/does-not-exist');
  check('unknown API path answers 404 JSON (used to hang)', r.status === 404 && r.data.error === 'Not found');
  r = await A.post('/api/bug-report', { title: 'It broke', description: 'Details' });
  check('bug report', r.status === 201 && r.data.ticket_id > 0, r);
  r = await A.get('/api/bug-report');
  check('past reports', r.data.length === 1);
  r = await A.post('/api/auth/device/unlink', { pin: 'bad' });
  check('unlink needs admin PIN', r.status === 401);
};
