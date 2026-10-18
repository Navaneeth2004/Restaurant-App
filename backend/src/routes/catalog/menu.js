'use strict';
/** /api/menu — menu items (photos are stored per restaurant). */
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const menu = require('../../services/catalog/menu');
const { makeUploader } = require('../../services/files/uploader');

const router = express.Router();
const upload = makeUploader('item', 5);
const changed = (req) => req.io.emit('menu_updated');

router.get('/', access.floor, (req, res) => res.json(menu.list()));
router.get('/category/:catId', access.floor, (req, res) => res.json(menu.byCategory(Number(req.params.catId))));

router.post('/', access.admin, upload.single('image'), handle((req, res) => {
  const item = menu.create(req.restaurantId, req.body || {}, req.file);
  changed(req);
  res.status(201).json(item);
}));
router.patch('/reorder', access.admin, handle((req, res) => {
  const out = menu.reorder((req.body || {}).items);
  changed(req);
  res.json(out);
}));
router.put('/:id', access.admin, upload.single('image'), handle((req, res) => {
  const item = menu.update(req.restaurantId, Number(req.params.id), req.body || {}, req.file);
  changed(req);
  res.json(item);
}));
router.delete('/:id', access.admin, handle((req, res) => {
  const out = menu.remove(req.restaurantId, Number(req.params.id));
  changed(req);
  res.json(out);
}));

module.exports = router;
