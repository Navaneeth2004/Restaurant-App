'use strict';
const express = require('express');
const access = require('../../middleware/access');
const { overview } = require('../../services/root/overview');
const audit = require('../../services/root/audit');

const router = express.Router();

router.get('/overview', access.root, (req, res) => res.json(overview()));
router.get('/audit', access.root, (req, res) => res.json(audit.list(req.query.limit)));

module.exports = router;
