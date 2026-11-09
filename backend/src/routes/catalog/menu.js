'use strict';
/** /api/menu — menu items (photos are stored per restaurant). */
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const menu = require('../../services/catalog/menu');
const { makeUploader } = require('../../services/files/uploader');

const router = express.Router();
const upload = makeUploader('item', 5);
const changed = (req) => req.io.emit('menu_updated');
const manage = feature.of('admin.menu');
const read = feature.of('waiter', 'admin.menu', 'admin.categories');

router.get('/', access.floor, read, (req, res) => res.json(menu.list()));
router.get('/category/:catId', access.floor, read, (req, res) => res.json(menu.byCategory(Number(req.params.catId))));

router.post('/', access.admin, manage, upload.single('image'), handle((req, res) => {
  const item = menu.create(req.restaurantId, req.body || {}, req.file);
  changed(req);
  res.status(201).json(item);
}));
router.patch('/reorder', access.admin, manage, handle((req, res) => {
  const out = menu.reorder((req.body || {}).items);
  changed(req);
  res.json(out);
}));
router.put('/:id', access.admin, manage, upload.single('image'), handle((req, res) => {
  const item = menu.update(req.restaurantId, Number(req.params.id), req.body || {}, req.file);
  changed(req);
  res.json(item);
}));
router.delete('/:id', access.admin, manage, handle((req, res) => {
  const out = menu.remove(req.restaurantId, Number(req.params.id));
  changed(req);
  res.json(out);
}));

module.exports = router;
