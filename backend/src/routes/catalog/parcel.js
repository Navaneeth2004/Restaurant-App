'use strict';
/** /api/parcel — takeaway slots. */
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const parcel = require('../../services/catalog/parcel');

const router = express.Router();
const on = feature.of('parcel');

router.post('/slot', access.floor, on, handle((req, res) => {
  const slot = parcel.createSlot(req.restaurantId, req.body || {});
  req.io.emit('tables_updated');
  res.status(201).json({ ...slot, kiosk_token: slot.kiosk_token });
}));
router.get('/slots', access.floor, on, (req, res) => res.json(parcel.listSlots()));
router.delete('/slot/:id', access.floor, on, handle((req, res) => {
  const out = parcel.removeSlot(req.params.id);
  req.io.emit('tables_updated');
  res.json(out);
}));

module.exports = router;
