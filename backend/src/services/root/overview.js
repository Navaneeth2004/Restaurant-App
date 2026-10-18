'use strict';
/** Numbers for the root console dashboard. */
const cfg = require('../../config/env');
const { LIMIT_KEYS, PLANS } = require('../../config/plans');
const restaurants = require('../../repositories/central/restaurants.repo');
const owners = require('../../repositories/central/owners.repo');
const devices = require('../../repositories/central/devices.repo');
const tickets = require('../../repositories/central/tickets.repo');
const supportTickets = require('../support/tickets');
const bus = require('../../realtime/bus');

function overview() {
  const byStatus = restaurants.countByStatus();
  return {
    restaurants: { total: byStatus.reduce((s, r) => s + r.n, 0), by_status: Object.fromEntries(byStatus.map(r => [r.status, r.n])) },
    owners: owners.countOwners(),
    devices: devices.countActiveAll(),
    tickets: { open: tickets.countOpen(), critical_open: tickets.countCritical() },
    connected_sockets: bus.connectedCount(),
    trial_ending_soon: restaurants.trialEndingBefore(new Date(Date.now() + 7 * 86400000).toISOString()),
    recent_tickets: tickets.recent(),
    recently_active: restaurants.recentlyActive(),
    server: {
      node: process.version, uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1048576), deployment: cfg.DEPLOYMENT,
    },
  };
}

function consoleConfig() {
  return {
    plans: Object.keys(PLANS),
    limit_keys: Object.entries(LIMIT_KEYS).map(([key, v]) => ({ key, label: v.label })),
    plan_defaults: PLANS,
    ticket_statuses: supportTickets.STATUSES,
    enforce_trial: cfg.ENFORCE_TRIAL,
  };
}

module.exports = { overview, consoleConfig };
