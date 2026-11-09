'use strict';
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const { offsetFromQuery } = require('../../lib/local-time');
const tables = require('../../services/catalog/tables');

const router = express.Router();
const manage = feature.of('admin.tables');

router.get('/', access.floor, feature.of('waiter', 'admin.floor', 'admin.tables'), (req, res) => res.json(tables.list()));
router.get('/:id/stats', access.floor, feature.of('admin.floor'), (req, res) => res.json(tables.stats(req.params.id, offsetFromQuery(req))));

router.post('/', access.admin, manage, handle((req, res) => {
  const table = tables.create(req.body || {});
  req.io.emit('tables_updated');
  res.status(201).json(table);
}));
router.patch('/reorder', access.admin, manage, handle((req, res) => {
  const out = tables.reorder((req.body || {}).order);
  req.io.emit('tables_updated');
  res.json(out);
}));
router.put('/:id', access.admin, manage, handle((req, res) => {
  const table = tables.update(req.params.id, req.body || {});
  req.io.emit('tables_updated', { table });
  res.json(table);
}));
router.delete('/:id', access.admin, manage, handle((req, res) => {
  const out = tables.remove(req.params.id);
  req.io.emit('tables_updated');
  res.json(out);
}));

module.exports = router;
