'use strict';
const reports = require('../../repositories/orders/reports.repo');
const { limitParam, dateOrNull } = require('../../lib/input');

const history = (query, offset) => reports.history({
  from: dateOrNull(query.from), to: dateOrNull(query.to), limit: limitParam(query.limit, 200, 1000), offset,
});

const revenueChart = (offset) => reports.revenueByDay(offset);

module.exports = { history, revenueChart };
