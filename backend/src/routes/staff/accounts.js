'use strict';
/** Staff accounts (admin only; PINs are never returned). */
const express = require('express');
const access = require('../../middleware/access');
const feature = require('../../middleware/feature');
const { handle } = require('../../lib/http');
const staffAdmin = require('../../services/staff/staff-admin');

const router = express.Router();
const on = feature.of('admin.staff');

router.get('/', access.admin, on, (req, res) => res.json(staffAdmin.list()));
router.post('/', access.admin, on, handle(async (req, res) => res.status(201).json(await staffAdmin.create(req.body || {}))));
router.put('/:id', access.admin, on, handle(async (req, res) => res.json(await staffAdmin.update(Number(req.params.id), req.body || {}))));
router.delete('/:id', access.admin, on, handle((req, res) => res.json(staffAdmin.remove(Number(req.params.id)))));

module.exports = router;
