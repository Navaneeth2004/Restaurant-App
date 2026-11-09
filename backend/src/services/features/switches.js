'use strict';
/** Global feature switches: turn a feature off for EVERY restaurant at once (for example while it is buggy). */
const { KEYS } = require('../../config/features');
const { fail } = require('../../lib/http');
const { clip } = require('../../lib/input');
const features = require('../../repositories/central/features.repo');
const catalog = require('./catalog');
const { notifyAll } = require('./notify');

const list = () => features.listSwitches();

/** @param off true = switch off for everyone (with an optional message users see), false = switch back on */
function set(feature, off, message) {
  if (!KEYS.has(feature)) fail(404, 'Unknown feature.');
  if (off) features.setSwitch(feature, clip(message, 200) || null, new Date().toISOString());
  else features.clearSwitch(feature);
  catalog.clear();
  notifyAll();
}

module.exports = { list, set };
