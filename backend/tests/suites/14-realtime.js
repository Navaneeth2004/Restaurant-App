'use strict';
/** Suite: realtime */
module.exports = async (t) => {
  const { A, base, check } = t;

  console.log('\n[realtime]');
  const ioc = require('socket.io-client');
  await new Promise((resolve) => {
    const sock = ioc(base, { extraHeaders: { cookie: A.cookieHeader() }, transports: ['websocket'] });
    sock.on('connect_error', (e) => { check('socket connects', false, e.message); resolve(); });
    sock.on('connect', async () => {
      // staff room is joined server-side after PIN login (promoteDevice) – verify by receiving an event
      await A.post('/api/staff/verify', { pin: '4826' });
      // the reset in the previous suite removed the menu: create one item (orders must carry real menu items)
      const cat = await A.post('/api/categories', { name: 'Live' });
      const fd = new FormData();
      fd.append('name', 'Live item'); fd.append('price', '3'); fd.append('category_id', String(cat.data.id));
      const item = (await A.call('POST', '/api/menu', fd)).data;
      sock.emit('join_staff', { staffId: 0, sessionToken: 'x' }, (ack) => check('join_staff with bad token refused', ack && ack.ok === false));
      let got = false;
      sock.on('new_order', () => { got = true; });
      await A.post('/api/orders', { table_id: 'T5', items: [{ menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }] });
      setTimeout(() => { check('staff device receives live new_order', got); sock.close(); resolve(); }, 400);
    });
  });
  const anonSock = ioc(base, { transports: ['websocket'] });
  await new Promise(res => { anonSock.on('connect_error', () => { check('socket without credentials rejected', true); res(); }); anonSock.on('connect', () => { check('socket without credentials rejected', false); res(); }); });
  anonSock.close();
};
