'use strict';
/** Subscriptions and global feature switches (central database). */
const central = require('../../db/central');

const listSubscriptions = () => central.prepare('SELECT * FROM subscriptions ORDER BY rowid').all();
const subscriptionBySlug = (slug) => central.prepare('SELECT * FROM subscriptions WHERE slug = ?').get(slug);
const insertSubscription = (s) => central.prepare(`
  INSERT INTO subscriptions (slug, name, description, limits_json, disabled_json, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?)`).run(s.slug, s.name, s.description, s.limits_json, s.disabled_json, s.now, s.now);
const updateSubscription = (slug, s, now) => central.prepare(`
  UPDATE subscriptions SET name = ?, description = ?, limits_json = ?, disabled_json = ?, updated_at = ? WHERE slug = ?`)
  .run(s.name, s.description, s.limits_json, s.disabled_json, now, slug);
const removeSubscription = (slug) => central.prepare('DELETE FROM subscriptions WHERE slug = ?').run(slug);
const restaurantsOnPlan = (slug) => central.prepare('SELECT COUNT(*) AS c FROM restaurants WHERE plan = ?').get(slug).c;
const planUsage = () => central.prepare('SELECT plan, COUNT(*) AS n FROM restaurants GROUP BY plan').all();

const listSwitches = () => central.prepare('SELECT feature, message, updated_at FROM feature_switches ORDER BY feature').all();
const setSwitch = (feature, message, now) =>
  central.prepare('INSERT OR REPLACE INTO feature_switches (feature, message, updated_at) VALUES (?,?,?)').run(feature, message, now);
const clearSwitch = (feature) => central.prepare('DELETE FROM feature_switches WHERE feature = ?').run(feature);

module.exports = {
  listSubscriptions, subscriptionBySlug, insertSubscription, updateSubscription, removeSubscription, restaurantsOnPlan, planUsage,
  listSwitches, setSwitch, clearSwitch,
};
