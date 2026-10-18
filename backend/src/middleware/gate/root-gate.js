'use strict';
/** Root console: its own cookie, no device / PIN involved. */
const { ROOT_COOKIE } = require('../../lib/cookies');
const rootSessions = require('../../services/root/sessions');

module.exports = (req, res, next) => {
  req._smallBody = true;
  if (req.path === '/root/login') return next();
  const session = rootSessions.find(req.cookies[ROOT_COOKIE]);
  if (!session) return res.status(401).json({ error: 'Please log in.', code: 'root_required' });
  req.root = session;
  return next();
};
