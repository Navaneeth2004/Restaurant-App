'use strict';
/** Loads the closed bills of a LOCAL date range together with the GST profile of the restaurant. */
const reports = require('../../repositories/orders/reports.repo');
const orderItems = require('../../repositories/orders/order-items.repo');
const settings = require('../../repositories/catalog/settings.repo');
const { STATE_CODES, DEFAULT_STATE, DEFAULT_STATE_CODE, DEFAULT_SAC } = require('../../config/gst');
const { dateOrNull } = require('../../lib/input');
const { localToday } = require('../../lib/local-time');
const { groupBills } = require('./bills');

function profile() {
  const S = settings.all();
  const stateName = S.state_name || DEFAULT_STATE;
  return {
    gstin: S.gstin || '',
    legalName: S.legal_name || S.restaurant_name || '',
    stateName, stateCode: STATE_CODES[stateName] || DEFAULT_STATE_CODE,
    sacCode: S.sac_code || DEFAULT_SAC,
    restaurantName: S.restaurant_name, currency: S.currency_symbol || '₹', taxPercentSetting: S.tax_percent,
  };
}

/** @returns { dateFrom, dateTo, offset, currentRate, profile, rows, bills } */
function loadRange({ from, to, offset, defaultFrom, withItems = false }) {
  const today = localToday(offset);
  const dateFrom = dateOrNull(from) || defaultFrom || `${today.slice(0, 7)}-01`;
  const dateTo = dateOrNull(to) || today;
  const currentRate = settings.taxPercent();
  const rows = reports.closedBetween(dateFrom, dateTo, offset);
  if (withItems) orderItems.attachTo(rows);
  return { dateFrom, dateTo, offset, currentRate, profile: profile(), rows, bills: groupBills(rows, { currentRate, offset }) };
}

const itemQuantity = (rows) => orderItems.totalQuantity(rows.map(r => r.id));

module.exports = { loadRange, itemQuantity, profile };
