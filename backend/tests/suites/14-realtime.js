'use strict';
/** Suite: realtime */
module.exports = async (t) => {
  const { A, base, check } = t;

  console.log('\n[realtime]');
  const ioc = require('socket.io-client');
  await new Promise((resolve) => {
    const sock = ioc(base, { extraHeaders: { cookie: A.cookieHeader() }, transports: ['websocket'] });
    let got = false;
    sock.on('connect_error', (e) => { check('socket connects', false, e.message); resolve(); });
    sock.on('connect', async () => {
      // staff room is joined server-side after PIN login (promoteDevice) – verify by receiving an event
      await A.post('/api/staff/verify', { pin: '4826' });
      sock.emit('join_staff', { staffId: 0, sessionToken: 'x' }, (ack) => check('join_staff with bad token refused', ack && ack.ok === false));
      sock.on('new_order', () => { got = true; });
      const menu = { id: 1, name: 'Item', price: 1 };
      await A.post('/api/orders', { table_id: 'T5', items: [{ menu_item_id: menu.id, name: menu.name, price: menu.price, quantity: 1 }] });
      setTimeout(() => { check('staff device receives live new_order', got); sock.close(); resolve(); }, 400);
    });
  });
  const anonSock = ioc(base, { transports: ['websocket'] });
  await new Promise(res => { anonSock.on('connect_error', () => { check('socket without credentials rejected', true); res(); }); anonSock.on('connect', () => { check('socket without credentials rejected', false); res(); }); });
  anonSock.close();
};
