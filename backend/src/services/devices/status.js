'use strict';
/** "What should this browser show first?" */
const cfg = require('../../config/env');
const ctx = require('../../db/context');
const settings = require('../../repositories/catalog/settings.repo');
const deviceService = require('./devices');
const access = require('../restaurants/access');

function deviceStatus(deviceCookie) {
  const base = { registration_open: cfg.ALLOW_REGISTRATION };
  const device = deviceService.find(deviceCookie);
  if (!device) return { linked: false, ...base };

  const r = access.activeRestaurant(device.restaurant_id);
  if (!r) return { linked: false, suspended: true, ...base };

  return ctx.run({ restaurantId: r.id }, () => ({
    linked: true,
    restaurant: {
      name: settings.get('restaurant_name') || r.name,
      brand_color: settings.get('brand_color'),
      logo_url: settings.get('logo_url'),
    },
    device: { id: device.id, name: device.name, role_lock: device.role_lock },
    ...base,
  }));
}

module.exports = { deviceStatus };
