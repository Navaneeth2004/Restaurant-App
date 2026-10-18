'use strict';
const express = require('express');
const access = require('../../middleware/access');
const { handle } = require('../../lib/http');
const categories = require('../../services/catalog/categories');

const router = express.Router();
const changed = (req) => req.io.emit('categories_updated');

router.get('/', access.floor, (req, res) => res.json(categories.list()));
router.post('/', access.admin, handle((req, res) => {
  const cat = categories.create((req.body || {}).name);
  changed(req);
  res.status(201).json(cat);
}));
router.patch('/reorder', access.admin, handle((req, res) => {
  const out = categories.reorder((req.body || {}).order);
  changed(req);
  res.json(out);
}));
router.put('/:id', access.admin, handle((req, res) => {
  const out = categories.update(Number(req.params.id), req.body || {});
  changed(req);
  res.json(out);
}));
router.delete('/:id', access.admin, handle((req, res) => {
  const out = categories.remove(Number(req.params.id));
  changed(req);
  res.json(out);
}));

module.exports = router;
